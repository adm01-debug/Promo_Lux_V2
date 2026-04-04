import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

// ── Structured Logger ──
function createLogger(requestId: string) {
  const base = { function: "workflow-engine", request_id: requestId };
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info", msg, ...data, ts: new Date().toISOString() })),
    warn: (msg: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...base, level: "warn", msg, ...data, ts: new Date().toISOString() })),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ ...base, level: "error", msg, ...data, ts: new Date().toISOString() })),
  };
}

function badRequest(corsHeaders: Record<string, string>, details: unknown) {
  return new Response(JSON.stringify({ error: "Invalid input", details }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Schemas ──

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(""),
  steps: z.array(z.record(z.unknown())).min(1).max(20),
  config: z.record(z.unknown()).default({}),
});

const RunWorkflowSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow_id"),
});

const ToggleStatusSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow_id"),
  new_status: z.enum(["active", "paused", "draft"]),
});

const ActionSchema = z.enum(["list", "create", "run", "toggle-status", "delete"]);

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const log = createLogger(requestId);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Validate JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn("auth_missing");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    log.warn("auth_invalid", { error: userError?.message });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = user.id;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const actionRaw = url.searchParams.get("action");

  const actionParsed = ActionSchema.safeParse(actionRaw);
  if (!actionParsed.success) {
    return badRequest(corsHeaders, { action: "Must be one of: list, create, run, toggle-status, delete" });
  }
  const action = actionParsed.data;

  log.info("request_start", { method: req.method, action, user_id: userId });

  try {
    // LIST workflows
    if (action === "list" && req.method === "GET") {
      const { data, error } = await supabase
        .from("workflows")
        .select("*, workflow_runs(id, status, started_at, completed_at, results)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, count: data?.length ?? 0 });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE workflow
    if (action === "create" && req.method === "POST") {
      const parsed = CreateWorkflowSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const body = parsed.data;

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          user_id: userId,
          name: body.name,
          description: body.description,
          status: "active",
          steps: body.steps,
          config: body.config,
        })
        .select()
        .single();
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, workflow_id: data.id });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RUN workflow
    if (action === "run" && req.method === "POST") {
      const parsed = RunWorkflowSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const { workflow_id } = parsed.data;

      const { data: workflow, error: wfError } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflow_id)
        .eq("user_id", userId)
        .single();
      if (wfError || !workflow) throw new Error("Workflow not found");

      log.info("workflow_run_start", { workflow_id, workflow_name: workflow.name });

      // Create run record
      const { data: run, error: runError } = await supabase
        .from("workflow_runs")
        .insert({ workflow_id, user_id: userId, status: "running", current_step: "scrape" })
        .select()
        .single();
      if (runError) throw runError;

      await supabase
        .from("workflows")
        .update({ status: "active", last_run_at: new Date().toISOString() })
        .eq("id", workflow_id)
        .eq("user_id", userId);

      const config = workflow.config as Record<string, unknown>;
      const results: Record<string, unknown> = {};

      // ===== STEP 1: SCRAPE =====
      await supabase.from("workflow_runs").update({ current_step: "scrape" }).eq("id", run.id);

      let scrapeJobId: string | null = null;
      try {
        const keywords = (config.keywords as string[]) || ["empresas"];
        const lang = (config.lang as string) || "pt";
        const radius = (config.radius as number) || 10000;
        const depth = (config.depth as number) || 1;
        const emailFlag = config.email !== undefined ? Boolean(config.email) : true;
        const fastMode = Boolean(config.fast_mode);

        const { data: scrapeJob } = await supabase
          .from("scrape_jobs")
          .insert({
            user_id: userId,
            name: `WF: ${workflow.name}`,
            status: "pending",
            source: "gmaps",
            config: {
              keywords, lang, radius, depth,
              email: emailFlag, fast_mode: fastMode,
              zoom: 15, lat: "0", lon: "0",
              max_time: 480000000000, proxies: [],
            },
          })
          .select()
          .single();

        scrapeJobId = scrapeJob?.id ?? null;

        let externalId: string | null = null;
        try {
          const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `WF: ${workflow.name}`,
              keywords, lang, radius, depth,
              email: emailFlag, fast_mode: fastMode,
              zoom: 15, lat: "0", lon: "0",
              max_time: 480000000000, proxies: [],
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const result = await res.json();
            externalId = result.id || result.ID;
          }
        } catch (err) {
          log.error("step_scrape_api_error", { error: (err as Error).message, workflow_id });
        }

        if (scrapeJobId) {
          await supabase
            .from("scrape_jobs")
            .update({ external_id: externalId, status: externalId ? "running" : "pending" })
            .eq("id", scrapeJobId);
        }

        results.scrape = {
          job_id: scrapeJobId,
          external_id: externalId,
          status: externalId ? "submitted" : "queued_locally",
          keywords,
        };
      } catch (err) {
        log.error("step_scrape_error", { error: (err as Error).message, workflow_id });
        results.scrape = { error: (err as Error).message };
      }

      // ===== STEP 2: ENRICH =====
      await supabase.from("workflow_runs").update({ current_step: "enrich" }).eq("id", run.id);

      let enrichedCount = 0;
      try {
        const { data: completedJobs } = await supabase
          .from("scrape_jobs")
          .select("id, external_id")
          .eq("status", "completed")
          .eq("source", "gmaps")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (completedJobs) {
          for (const job of completedJobs) {
            if (!job.external_id) continue;

            const { count } = await supabase
              .from("scrape_results")
              .select("id", { count: "exact", head: true })
              .eq("job_id", job.id);

            if ((count || 0) > 0) continue;

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

                const { data: company } = await supabase
                  .from("companies")
                  .insert({
                    user_id: userId,
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
                    user_id: userId,
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
            } catch (err) {
              log.error("step_enrich_download_error", { error: (err as Error).message, job_id: job.id });
            }
          }
        }

        results.enrich = { companies_imported: enrichedCount, status: "completed" };
      } catch (err) {
        log.error("step_enrich_error", { error: (err as Error).message, workflow_id });
        results.enrich = { error: (err as Error).message };
      }

      // ===== STEP 3: IPC SCORING =====
      await supabase.from("workflow_runs").update({ current_step: "ipc_score" }).eq("id", run.id);

      let scoredCount = 0;
      try {
        const { data: ipcConfig } = await supabase
          .from("ipc_config")
          .select("*")
          .eq("is_active", true)
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        const criteria = (ipcConfig?.criteria || {}) as Record<string, unknown>;
        const criterSectors = (criteria.sectors || []) as string[];
        const criterLocations = (criteria.locations || []) as string[];

        const { data: unscoredCompanies } = await supabase
          .from("companies")
          .select("*")
          .eq("ipc_score", 0)
          .eq("user_id", userId)
          .limit(500);

        if (unscoredCompanies) {
          for (const company of unscoredCompanies) {
            let score = 0;

            if (criterSectors.length > 0) {
              const matches = criterSectors.some((s) =>
                company.sector?.toLowerCase().includes(s.toLowerCase())
              );
              score += matches ? 30 : 5;
            } else {
              score += 15;
            }

            if (criterLocations.length > 0) {
              const matches = criterLocations.some((l) =>
                company.location?.toLowerCase().includes(l.toLowerCase())
              );
              score += matches ? 25 : 5;
            } else {
              score += 10;
            }

            if (company.email) score += 15;
            if (company.phone) score += 10;
            if (company.website) score += 10;

            const raw = (company.raw_data || {}) as Record<string, unknown>;
            if (raw.rating && parseFloat(String(raw.rating)) >= 4.0) score += 10;
            if (raw.reviews_count && parseInt(String(raw.reviews_count)) > 50) score += 5;

            score = Math.min(score, 100);

            await supabase.from("companies").update({ ipc_score: score }).eq("id", company.id).eq("user_id", userId);
            scoredCount++;
          }
        }

        const { data: unprocessedResults } = await supabase
          .from("scrape_results")
          .select("id")
          .eq("processed", false)
          .eq("user_id", userId)
          .limit(500);

        if (unprocessedResults && unprocessedResults.length > 0) {
          const ids = unprocessedResults.map(r => r.id);
          await supabase.from("scrape_results").update({ processed: true }).in("id", ids);
        }

        results.ipc_score = { companies_scored: scoredCount, status: "completed" };
      } catch (err) {
        log.error("step_ipc_score_error", { error: (err as Error).message, workflow_id });
        results.ipc_score = { error: (err as Error).message };
      }

      // ===== STEP 4: FINALIZE =====
      await supabase.from("workflow_runs").update({ current_step: "save" }).eq("id", run.id);

      const { count: qualifiedCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("ipc_score", 70)
        .eq("user_id", userId);

      const { count: totalCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const totalProcessed = totalCount || 0;
      const totalQualified = qualifiedCount || 0;
      const successRate = totalProcessed > 0
        ? Math.round((totalQualified / totalProcessed) * 100)
        : 0;

      await supabase
        .from("workflows")
        .update({ leads_processed: totalProcessed, leads_qualified: totalQualified, success_rate: successRate })
        .eq("id", workflow_id)
        .eq("user_id", userId);

      results.summary = { total_companies: totalProcessed, qualified: totalQualified, success_rate: successRate };

      await supabase
        .from("workflow_runs")
        .update({ status: "completed", current_step: null, results, completed_at: new Date().toISOString() })
        .eq("id", run.id);

      const duration = Math.round(performance.now() - start);
      log.info("workflow_run_complete", {
        workflow_id, run_id: run.id, duration_ms: duration,
        enriched: enrichedCount, scored: scoredCount, qualified: totalQualified,
      });

      return new Response(JSON.stringify({ run_id: run.id, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PAUSE / RESUME workflow
    if (action === "toggle-status" && req.method === "POST") {
      const parsed = ToggleStatusSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const { workflow_id, new_status } = parsed.data;

      const { error } = await supabase
        .from("workflows")
        .update({ status: new_status })
        .eq("id", workflow_id)
        .eq("user_id", userId);
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, workflow_id, new_status });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE workflow
    if (action === "delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id || !z.string().uuid().safeParse(id).success) {
        return badRequest(corsHeaders, { id: "Valid UUID required" });
      }
      const { error } = await supabase.from("workflows").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, workflow_id: id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error("request_failed", { error: (err as Error).message, action, duration_ms: duration });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
