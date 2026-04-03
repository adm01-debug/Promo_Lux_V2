import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://id-preview--5ca97528-7ced-45bf-b83a-48ae8b7f46fc.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // LIST JOBS — fetches from external API and syncs to DB
    if (action === "list" && req.method === "GET") {
      // Try external API first
      let externalJobs: any[] = [];
      let apiOnline = false;
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          externalJobs = await res.json();
          apiOnline = true;

          // Sync external jobs to DB
          for (const job of externalJobs) {
            const { data: existing } = await supabase
              .from("scrape_jobs")
              .select("id")
              .eq("external_id", job.ID)
              .maybeSingle();

            if (!existing) {
              await supabase.from("scrape_jobs").insert({
                external_id: job.ID,
                name: job.Name,
                status: job.Status === "ok" ? "completed" : job.Status,
                source: "gmaps",
                config: job.Data,
                started_at: job.Date,
              });
            } else {
              await supabase
                .from("scrape_jobs")
                .update({ status: job.Status === "ok" ? "completed" : job.Status })
                .eq("external_id", job.ID);
            }
          }
        }
      } catch (_) {
        // API offline, fall through to DB
      }

      // Return jobs from DB (source of truth)
      const { data: dbJobs, error } = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("source", "gmaps")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ jobs: dbJobs, api_online: apiOnline }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // CREATE JOB — sends to external API and saves to DB
    if (action === "create" && req.method === "POST") {
      const body = await req.json();

      // Save to DB first
      const { data: dbJob, error: dbError } = await supabase
        .from("scrape_jobs")
        .insert({
          name: body.name,
          status: "pending",
          source: "gmaps",
          config: {
            keywords: body.keywords,
            lang: body.lang || "pt",
            zoom: body.zoom || 15,
            lat: body.lat || "0",
            lon: body.lon || "0",
            fast_mode: body.fast_mode ?? false,
            radius: body.radius || 10000,
            depth: body.depth || 1,
            email: body.email ?? true,
            max_time: body.max_time || 480000000000,
            proxies: body.proxies || [],
          },
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Try to send to external API
      let externalId: string | null = null;
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: body.name,
            keywords: body.keywords,
            lang: body.lang || "pt",
            zoom: body.zoom || 15,
            lat: body.lat || "0",
            lon: body.lon || "0",
            fast_mode: body.fast_mode ?? false,
            radius: body.radius || 10000,
            depth: body.depth || 1,
            email: body.email ?? true,
            max_time: body.max_time || 480000000000,
            proxies: body.proxies || [],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const result = await res.json();
          externalId = result.id || result.ID;

          await supabase
            .from("scrape_jobs")
            .update({ external_id: externalId, status: "running" })
            .eq("id", dbJob.id);
        }
      } catch (_) {
        // API offline — job saved locally with pending status
      }

      return new Response(
        JSON.stringify({ id: dbJob.id, external_id: externalId, status: externalId ? "running" : "pending" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // DELETE JOB
    if (action === "delete" && req.method === "DELETE") {
      const jobId = url.searchParams.get("id");
      if (!jobId) throw new Error("Missing job id");

      // Get external ID to delete from API too
      const { data: job } = await supabase
        .from("scrape_jobs")
        .select("external_id")
        .eq("id", jobId)
        .single();

      if (job?.external_id) {
        try {
          await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}`, {
            method: "DELETE",
            signal: AbortSignal.timeout(5000),
          });
        } catch (_) {}
      }

      const { error } = await supabase.from("scrape_jobs").delete().eq("id", jobId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // SYNC RESULTS — imports scrape results and creates companies
    if (action === "sync-results" && req.method === "POST") {
      const { job_id } = await req.json();

      const { data: job } = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (!job?.external_id) throw new Error("Job not found or has no external ID");

      // Download CSV from external API
      let results: any[] = [];
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}/download`, {
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const text = await res.text();
          // Parse CSV to JSON (simple parser)
          const lines = text.split("\n").filter(Boolean);
          if (lines.length > 1) {
            const headers = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, ""));
            results = lines.slice(1).map((line: string) => {
              const values = line.split(",").map((v: string) => v.trim().replace(/"/g, ""));
              const obj: Record<string, string> = {};
              headers.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });
              return obj;
            });
          }
        }
      } catch (_) {
        throw new Error("Failed to download results from external API");
      }

      // Get active IPC config for scoring
      const { data: ipcConfig } = await supabase
        .from("ipc_config")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      let companiesCreated = 0;

      for (const result of results) {
        // Calculate IPC score based on config criteria
        let ipcScore = 0;
        if (ipcConfig?.criteria) {
          const criteria = ipcConfig.criteria as Record<string, any>;
          // Simple scoring: check if company matches criteria
          if (criteria.sectors?.includes(result.category || result.type)) ipcScore += 30;
          if (criteria.locations?.includes(result.city || result.address)) ipcScore += 20;
          if (result.email) ipcScore += 15;
          if (result.phone) ipcScore += 10;
          if (result.website) ipcScore += 10;
          if (result.rating && parseFloat(result.rating) >= 4) ipcScore += 15;
        } else {
          // Default scoring without IPC config
          ipcScore = 50;
          if (result.email) ipcScore += 15;
          if (result.phone) ipcScore += 10;
          if (result.website) ipcScore += 10;
          if (result.rating && parseFloat(result.rating) >= 4) ipcScore += 15;
        }

        // Create company
        const { data: company, error: compError } = await supabase
          .from("companies")
          .insert({
            name: result.name || result.title || "Unknown",
            sector: result.category || result.type || "Não classificado",
            location: result.address || result.city || "",
            website: result.website || result.web_site || "",
            phone: result.phone || "",
            email: result.email || "",
            source: "gmaps",
            ipc_score: Math.min(ipcScore, 100),
            enriched: !!(result.email || result.phone),
            raw_data: result,
          })
          .select()
          .single();

        if (company) {
          companiesCreated++;
          // Save scrape result linked to job and company
          await supabase.from("scrape_results").insert({
            job_id: job_id,
            company_id: company.id,
            raw_data: result,
            processed: true,
          });
        }
      }

      // Update job with results count
      await supabase
        .from("scrape_jobs")
        .update({ results_count: companiesCreated, status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job_id);

      // Create a single grouped notification
      if (companiesCreated > 0) {
        await supabase.from("notifications").insert({
          type: "scrape",
          title: companiesCreated === 1
            ? "Nova empresa importada"
            : `${companiesCreated} novas empresas importadas`,
          message: companiesCreated === 1
            ? `1 empresa foi importada via Google Maps.`
            : `${companiesCreated} empresas foram importadas via Google Maps.`,
          metadata: { job_id, job_name: job.name, companies_created: companiesCreated, total_results: results.length },
        });
      }

      return new Response(
        JSON.stringify({ companies_created: companiesCreated, total_results: results.length }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
