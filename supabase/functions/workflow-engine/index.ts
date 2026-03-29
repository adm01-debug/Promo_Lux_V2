import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // LIST workflows
    if (action === "list" && req.method === "GET") {
      const { data, error } = await supabase
        .from("workflows")
        .select("*, workflow_runs(id, status, started_at, completed_at, results)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE workflow
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          name: body.name,
          description: body.description,
          status: "active",
          steps: body.steps,
          config: body.config || {},
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RUN workflow — executes the full pipeline
    if (action === "run" && req.method === "POST") {
      const { workflow_id } = await req.json();

      const { data: workflow, error: wfError } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflow_id)
        .single();
      if (wfError || !workflow) throw new Error("Workflow not found");

      // Create run record
      const { data: run, error: runError } = await supabase
        .from("workflow_runs")
        .insert({ workflow_id, status: "running", current_step: "scrape" })
        .select()
        .single();
      if (runError) throw runError;

      // Update workflow status
      await supabase
        .from("workflows")
        .update({ status: "active", last_run_at: new Date().toISOString() })
        .eq("id", workflow_id);

      const config = workflow.config as Record<string, any>;
      const results: Record<string, any> = {};

      // ===== STEP 1: SCRAPE (Google Maps) =====
      await supabase
        .from("workflow_runs")
        .update({ current_step: "scrape" })
        .eq("id", run.id);

      let scrapeJobId: string | null = null;
      try {
        // Create scrape job in DB
        const { data: scrapeJob } = await supabase
          .from("scrape_jobs")
          .insert({
            name: `WF: ${workflow.name}`,
            status: "pending",
            source: "gmaps",
            config: {
              keywords: config.keywords || ["empresas"],
              lang: config.lang || "pt",
              radius: config.radius || 10000,
              depth: config.depth || 1,
              email: config.email ?? true,
              fast_mode: config.fast_mode ?? false,
              zoom: 15,
              lat: config.lat || "0",
              lon: config.lon || "0",
              max_time: 480000000000,
              proxies: [],
            },
          })
          .select()
          .single();

        scrapeJobId = scrapeJob?.id;

        // Try external API
        let externalId: string | null = null;
        try {
          const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `WF: ${workflow.name}`,
              keywords: config.keywords || ["empresas"],
              lang: config.lang || "pt",
              radius: config.radius || 10000,
              depth: config.depth || 1,
              email: config.email ?? true,
              fast_mode: config.fast_mode ?? false,
              zoom: 15,
              lat: "0",
              lon: "0",
              max_time: 480000000000,
              proxies: [],
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const result = await res.json();
            externalId = result.id || result.ID;
          }
        } catch (_) {}

        if (scrapeJobId) {
          await supabase
            .from("scrape_jobs")
            .update({
              external_id: externalId,
              status: externalId ? "running" : "pending",
            })
            .eq("id", scrapeJobId);
        }

        results.scrape = {
          job_id: scrapeJobId,
          external_id: externalId,
          status: externalId ? "submitted" : "queued_locally",
          keywords: config.keywords,
        };
      } catch (err) {
        results.scrape = { error: err.message };
      }

      // ===== STEP 2: ENRICH (check existing unprocessed results) =====
      await supabase
        .from("workflow_runs")
        .update({ current_step: "enrich" })
        .eq("id", run.id);

      let enrichedCount = 0;
      try {
        // Look for completed scrape jobs that have results not yet processed
        const { data: completedJobs } = await supabase
          .from("scrape_jobs")
          .select("id, external_id")
          .eq("status", "completed")
          .eq("source", "gmaps")
          .order("created_at", { ascending: false })
          .limit(5);

        if (completedJobs) {
          for (const job of completedJobs) {
            if (!job.external_id) continue;

            // Check if already has results
            const { count } = await supabase
              .from("scrape_results")
              .select("id", { count: "exact", head: true })
              .eq("job_id", job.id);

            if ((count || 0) > 0) continue;

            // Try to download and process results
            try {
              const res = await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}/download`, {
                signal: AbortSignal.timeout(15000),
              });
              if (!res.ok) continue;

              const text = await res.text();
              const lines = text.split("\n").filter(Boolean);
              if (lines.length <= 1) continue;

              const headers = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, ""));

              for (let li = 1; li < lines.length; li++) {
                const values = lines[li].split(",").map((v: string) => v.trim().replace(/"/g, ""));
                const obj: Record<string, string> = {};
                headers.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });

                // Create company
                const { data: company } = await supabase
                  .from("companies")
                  .insert({
                    name: obj.name || obj.title || "Unknown",
                    sector: obj.category || obj.type || "Não classificado",
                    location: obj.address || obj.city || "",
                    website: obj.website || obj.web_site || "",
                    phone: obj.phone || "",
                    email: obj.email || "",
                    source: "gmaps",
                    enriched: !!(obj.email || obj.phone),
                    raw_data: obj,
                  })
                  .select()
                  .single();

                if (company) {
                  await supabase.from("scrape_results").insert({
                    job_id: job.id,
                    company_id: company.id,
                    raw_data: obj,
                    processed: false,
                  });
                  enrichedCount++;
                }
              }

              await supabase
                .from("scrape_jobs")
                .update({ results_count: enrichedCount })
                .eq("id", job.id);
            } catch (_) {}
          }
        }

        results.enrich = {
          companies_imported: enrichedCount,
          status: "completed",
        };
      } catch (err) {
        results.enrich = { error: err.message };
      }

      // ===== STEP 3: IPC SCORING =====
      await supabase
        .from("workflow_runs")
        .update({ current_step: "ipc_score" })
        .eq("id", run.id);

      let scoredCount = 0;
      try {
        // Get IPC config
        const { data: ipcConfig } = await supabase
          .from("ipc_config")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        const criteria = (ipcConfig?.criteria || {}) as Record<string, any>;

        // Score all unscored companies (ipc_score = 0)
        const { data: unscoredCompanies } = await supabase
          .from("companies")
          .select("*")
          .eq("ipc_score", 0)
          .limit(500);

        if (unscoredCompanies) {
          for (const company of unscoredCompanies) {
            let score = 0;

            // Sector match
            if (criteria.sectors && criteria.sectors.length > 0) {
              const matches = criteria.sectors.some((s: string) =>
                company.sector?.toLowerCase().includes(s.toLowerCase())
              );
              score += matches ? 30 : 5;
            } else {
              score += 15;
            }

            // Location match
            if (criteria.locations && criteria.locations.length > 0) {
              const matches = criteria.locations.some((l: string) =>
                company.location?.toLowerCase().includes(l.toLowerCase())
              );
              score += matches ? 25 : 5;
            } else {
              score += 10;
            }

            // Data completeness
            if (company.email) score += 15;
            if (company.phone) score += 10;
            if (company.website) score += 10;

            // Raw data quality
            const raw = (company.raw_data || {}) as Record<string, any>;
            if (raw.rating && parseFloat(raw.rating) >= 4.0) score += 10;
            if (raw.reviews_count && parseInt(raw.reviews_count) > 50) score += 5;

            score = Math.min(score, 100);

            await supabase
              .from("companies")
              .update({ ipc_score: score })
              .eq("id", company.id);

            scoredCount++;
          }
        }

        // Mark scrape results as processed
        const { data: unprocessedResults } = await supabase
          .from("scrape_results")
          .select("id")
          .eq("processed", false)
          .limit(500);

        if (unprocessedResults && unprocessedResults.length > 0) {
          const ids = unprocessedResults.map(r => r.id);
          await supabase
            .from("scrape_results")
            .update({ processed: true })
            .in("id", ids);
        }

        results.ipc_score = {
          companies_scored: scoredCount,
          status: "completed",
        };
      } catch (err) {
        results.ipc_score = { error: err.message };
      }

      // ===== STEP 4: FINALIZE =====
      await supabase
        .from("workflow_runs")
        .update({ current_step: "save" })
        .eq("id", run.id);

      // Get qualified count (score >= 70)
      const { count: qualifiedCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("ipc_score", 70);

      const { count: totalCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true });

      const totalProcessed = (totalCount || 0);
      const totalQualified = (qualifiedCount || 0);
      const successRate = totalProcessed > 0
        ? Math.round((totalQualified / totalProcessed) * 100)
        : 0;

      // Update workflow stats
      await supabase
        .from("workflows")
        .update({
          leads_processed: totalProcessed,
          leads_qualified: totalQualified,
          success_rate: successRate,
        })
        .eq("id", workflow_id);

      results.summary = {
        total_companies: totalProcessed,
        qualified: totalQualified,
        success_rate: successRate,
      };

      // Complete the run
      await supabase
        .from("workflow_runs")
        .update({
          status: "completed",
          current_step: null,
          results,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(JSON.stringify({ run_id: run.id, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PAUSE / RESUME workflow
    if (action === "toggle-status" && req.method === "POST") {
      const { workflow_id, new_status } = await req.json();
      const { error } = await supabase
        .from("workflows")
        .update({ status: new_status })
        .eq("id", workflow_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE workflow
    if (action === "delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) throw new Error("Missing workflow id");
      const { error } = await supabase.from("workflows").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Workflow engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
