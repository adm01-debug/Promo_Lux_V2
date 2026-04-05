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

// ── Rate Limiter (in-memory token bucket per user) ──
const rateLimitStore = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT = { maxTokens: 20, refillRate: 5, windowMs: 60_000 }; // 20 req/min

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let bucket = rateLimitStore.get(userId);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT.maxTokens, lastRefill: now };
    rateLimitStore.set(userId, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / RATE_LIMIT.windowMs) * RATE_LIMIT.refillRate;
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_LIMIT.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens <= 0) {
    return { allowed: false, retryAfterMs: RATE_LIMIT.windowMs - (now - bucket.lastRefill) };
  }
  bucket.tokens--;
  return { allowed: true, retryAfterMs: 0 };
}

// ── Structured Logger ──
function createLogger(requestId: string) {
  const base = { function: "gmaps-proxy", request_id: requestId };
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

function rateLimitedResponse(corsHeaders: Record<string, string>, retryAfterMs: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Please wait before trying again." }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    },
  });
}

// ── Schemas ──

const CreateJobSchema = z.object({
  name: z.string().min(1).max(255),
  keywords: z.array(z.string().min(1).max(200)).min(1).max(20),
  lang: z.string().min(2).max(5).default("pt"),
  zoom: z.number().int().min(1).max(21).default(15),
  lat: z.string().max(30).default("0"),
  lon: z.string().max(30).default("0"),
  fast_mode: z.boolean().default(false),
  radius: z.number().int().min(100).max(100000).default(10000),
  depth: z.number().int().min(1).max(10).default(1),
  email: z.boolean().default(true),
  max_time: z.number().int().positive().default(480000000000),
  proxies: z.array(z.string().max(500)).max(10).default([]),
});

const SyncResultsSchema = z.object({
  job_id: z.string().uuid("Invalid job_id"),
});

const ActionSchema = z.enum(["list", "create", "delete", "sync-results"]);

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

  // Rate limit check
  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    log.warn("rate_limited", { user_id: userId });
    return rateLimitedResponse(corsHeaders, rl.retryAfterMs);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const actionRaw = url.searchParams.get("action");

  // Validate action param
  const actionParsed = ActionSchema.safeParse(actionRaw);
  if (!actionParsed.success) {
    return badRequest(corsHeaders, { action: "Must be one of: list, create, delete, sync-results" });
  }
  const action = actionParsed.data;

  log.info("request_start", { method: req.method, action, user_id: userId });

  try {
    // LIST JOBS
    if (action === "list" && req.method === "GET") {
      let externalJobs: Record<string, unknown>[] = [];
      let apiOnline = false;
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          externalJobs = await res.json();
          apiOnline = true;

          for (const job of externalJobs) {
            const { data: existing } = await supabase
              .from("scrape_jobs")
              .select("id")
              .eq("external_id", job.ID as string)
              .eq("user_id", userId)
              .maybeSingle();

            if (!existing) {
              await supabase.from("scrape_jobs").insert({
                user_id: userId,
                external_id: job.ID as string,
                name: job.Name as string,
                status: (job.Status as string) === "ok" ? "completed" : job.Status as string,
                source: "gmaps",
                config: job.Data as Record<string, unknown>,
                started_at: job.Date as string,
              });
            } else {
              await supabase
                .from("scrape_jobs")
                .update({ status: (job.Status as string) === "ok" ? "completed" : job.Status as string })
                .eq("external_id", job.ID as string)
                .eq("user_id", userId);
            }
          }
        }
      } catch (err) {
        log.error("gmaps_api_list_error", { error: (err as Error).message });
      }

      const { data: dbJobs, error } = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("source", "gmaps")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, jobs_count: dbJobs?.length ?? 0 });

      return new Response(JSON.stringify({ jobs: dbJobs, api_online: apiOnline }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE JOB
    if (action === "create" && req.method === "POST") {
      const parsed = CreateJobSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const body = parsed.data;

      const { data: dbJob, error: dbError } = await supabase
        .from("scrape_jobs")
        .insert({
          user_id: userId,
          name: body.name,
          status: "pending",
          source: "gmaps",
          config: {
            keywords: body.keywords,
            lang: body.lang,
            zoom: body.zoom,
            lat: body.lat,
            lon: body.lon,
            fast_mode: body.fast_mode,
            radius: body.radius,
            depth: body.depth,
            email: body.email,
            max_time: body.max_time,
            proxies: body.proxies,
          },
        })
        .select()
        .single();

      if (dbError) throw dbError;

      let externalId: string | null = null;
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: body.name,
            keywords: body.keywords,
            lang: body.lang,
            zoom: body.zoom,
            lat: body.lat,
            lon: body.lon,
            fast_mode: body.fast_mode,
            radius: body.radius,
            depth: body.depth,
            email: body.email,
            max_time: body.max_time,
            proxies: body.proxies,
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
      } catch (err) {
        log.error("gmaps_api_create_error", { error: (err as Error).message });
      }

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, job_id: dbJob.id, external_id: externalId });

      return new Response(
        JSON.stringify({ id: dbJob.id, external_id: externalId, status: externalId ? "running" : "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE JOB
    if (action === "delete" && req.method === "DELETE") {
      const jobId = url.searchParams.get("id");
      if (!jobId || !z.string().uuid().safeParse(jobId).success) {
        return badRequest(corsHeaders, { id: "Valid UUID required" });
      }

      const { data: job } = await supabase
        .from("scrape_jobs")
        .select("external_id")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single();

      if (job?.external_id) {
        try {
          await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}`, {
            method: "DELETE",
            signal: AbortSignal.timeout(5000),
          });
        } catch (err) {
          log.error("gmaps_api_delete_error", { error: (err as Error).message, job_id: jobId });
        }
      }

      const { error } = await supabase.from("scrape_jobs").delete().eq("id", jobId).eq("user_id", userId);
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, job_id: jobId });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SYNC RESULTS
    if (action === "sync-results" && req.method === "POST") {
      const parsed = SyncResultsSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const { job_id } = parsed.data;

      const { data: job } = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", userId)
        .single();

      if (!job?.external_id) {
        return new Response(JSON.stringify({ error: "Job not found or has no external ID" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let results: Record<string, string>[] = [];
      try {
        const res = await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}/download`, {
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const text = await res.text();
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
      } catch (err) {
        log.error("gmaps_api_download_error", { error: (err as Error).message, job_id });
        return new Response(JSON.stringify({ error: "Failed to download results from external service." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ipcConfig } = await supabase
        .from("ipc_config")
        .select("*")
        .eq("is_active", true)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      let companiesCreated = 0;

      for (const result of results) {
        let ipcScore = 0;
        if (ipcConfig?.criteria) {
          const criteria = ipcConfig.criteria as Record<string, unknown>;
          const sectors = criteria.sectors as string[] | undefined;
          const locations = criteria.locations as string[] | undefined;
          if (sectors?.includes(result.category || result.type)) ipcScore += 30;
          if (locations?.includes(result.city || result.address)) ipcScore += 20;
          if (result.email) ipcScore += 15;
          if (result.phone) ipcScore += 10;
          if (result.website) ipcScore += 10;
          if (result.rating && parseFloat(result.rating) >= 4) ipcScore += 15;
        } else {
          ipcScore = 50;
          if (result.email) ipcScore += 15;
          if (result.phone) ipcScore += 10;
          if (result.website) ipcScore += 10;
          if (result.rating && parseFloat(result.rating) >= 4) ipcScore += 15;
        }

        const { data: company } = await supabase
          .from("companies")
          .upsert({
            user_id: userId,
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
          }, { onConflict: "name,source" })
          .select()
          .single();

        if (company) {
          companiesCreated++;
          await supabase.from("scrape_results").insert({
            user_id: userId,
            job_id: job_id,
            company_id: company.id,
            raw_data: result,
            processed: true,
          });
        }
      }

      await supabase
        .from("scrape_jobs")
        .update({ results_count: companiesCreated, status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job_id)
        .eq("user_id", userId);

      if (companiesCreated > 0) {
        await supabase.from("notifications").insert({
          user_id: userId,
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

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, companies_created: companiesCreated, total_results: results.length });

      return new Response(
        JSON.stringify({ companies_created: companiesCreated, total_results: results.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error("request_failed", { error: (err as Error).message, stack: (err as Error).stack, duration_ms: duration });
    return new Response(JSON.stringify({ error: "Internal server error. Please try again later.", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
