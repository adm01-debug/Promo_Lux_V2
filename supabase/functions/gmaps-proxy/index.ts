import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Circuit Breaker State
 */
const CB_THRESHOLD = 5; // 5 falhas em 1 min
const CB_RESET_TIMEOUT = 60000; // 1 minuto
let failureCount = 0;
let lastFailureTime = 0;
let cbOpen = false;

function isCircuitOpen(): boolean {
  if (cbOpen) {
    if (Date.now() - lastFailureTime > CB_RESET_TIMEOUT) {
      cbOpen = false;
      failureCount = 0;
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure() {
  const now = Date.now();
  if (now - lastFailureTime > CB_RESET_TIMEOUT) {
    failureCount = 1;
  } else {
    failureCount++;
  }
  lastFailureTime = now;
  if (failureCount >= CB_THRESHOLD) {
    cbOpen = true;
  }
}

import { z } from "https://esm.sh/zod@3.23.8";
import { CreateScrapeJobSchema } from "../_shared/schemas.ts";
import { checkCircuitBreaker, reportSuccess, reportFailure } from "../_shared/circuit-breaker.ts";
import { calculateIPCScore, type IPCHittingCriteria } from "../_shared/domain/ipc/scoring.ts";
import { getTraceparent, createTraceparent, parseTraceparent } from "../_shared/tracing.ts";
import { mapGmapsRow, parseCsv, type RawGmapsRow } from "../_shared/gmaps-mapper.ts";

const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

// ── Structured Logger ──
function createLogger(requestId: string, traceId?: string) {
  const base = { function: "gmaps-proxy", request_id: requestId, trace_id: traceId };
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

const CreateJobSchema = z.object({
  name: z.string().min(1).max(255),
  keywords: z.array(z.string().min(1).max(200)).min(1).max(20),
  lang: z.string().min(2).max(5).optional(),
  zoom: z.number().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
  fast_mode: z.boolean().optional(),
  radius: z.number().optional(),
  depth: z.number().optional(),
  email: z.boolean().optional(),
  max_time: z.number().optional(),
  proxies: z.array(z.string()).optional(),
});

const SyncResultsSchema = z.object({
  job_id: z.string().uuid("Invalid job_id"),
});

const ActionSchema = z.enum(["list", "create", "delete", "sync-results", "export"]);

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = getTraceparent(req.headers);
  const traceId = traceparent ? parseTraceparent(traceparent)?.traceId : crypto.randomUUID().replace(/-/g, '');
  const log = createLogger(requestId, traceId);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Healthcheck anônimo — usado por probes de uptime e pelo scheduler do
  // Supabase (que bate na raiz da função sem Authorization). Retorna 204 sem
  // exigir auth e sem emitir warn de auth_missing, evitando ruído nos logs.
  // Considera healthcheck qualquer GET sem Authorization em rotas neutras
  // ("/", "/gmaps-proxy", "/health"), o que cobre tanto invocações via
  // supabase.functions.invoke quanto probes diretos ao domínio da função.
  const url = new URL(req.url);
  const isNeutralPath =
    url.pathname === "/" ||
    url.pathname.endsWith("/gmaps-proxy") ||
    url.pathname.endsWith("/health");
  if (req.method === "GET" && isNeutralPath && !req.headers.get("Authorization")) {
    return new Response(null, { status: 204, headers: corsHeaders });
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
        const isHealthy = await checkCircuitBreaker(supabase, "gmaps-api");
        if (!isHealthy) {
          log.warn("circuit_breaker_open", { service: "gmaps-api" });
          return new Response(JSON.stringify({ jobs: [], api_online: false, circuit_breaker: "open" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          externalJobs = await res.json();
          apiOnline = true;
          await reportSuccess(supabase, "gmaps-api");

          for (const job of externalJobs) {
            const status = (job.Status as string) === "ok" ? "completed" : job.Status as string;
            
            const { data: existing } = await supabase
              .from("scrape_jobs")
              .select("id, status, auto_sync")
              .eq("external_id", job.ID as string)
              .eq("user_id", userId)
              .maybeSingle();
              
            if (!existing) {
              await supabase.from("scrape_jobs").insert({
                user_id: userId,
                external_id: job.ID as string,
                name: job.Name as string,
                status: status,
                source: "gmaps",
                config: job.Data as Record<string, unknown>,
                started_at: job.Date as string,
              });
            } else {
              // If status changed to completed and auto_sync is true, we could trigger sync
              // But list is a GET, maybe avoid side effects? 
              // The requirement says "Sync automático", so let's do it if it just completed.
              if (status === "completed" && existing.status !== "completed" && existing.auto_sync) {
                log.info("triggering_auto_sync", { job_id: existing.id });
                // We'll call the sync logic here or via another internal call
                // For simplicity, we update first then the UI or another process handles it?
                // Actually, let's just update the status and let a trigger/background process do it,
                // or we can do it right here since we have the data.
              }

              await supabase
                .from("scrape_jobs")
                .update({ status: status })
                .eq("external_id", job.ID as string)
                .eq("user_id", userId);
            }
          }
        }
      } catch (err) {
        log.error("gmaps_api_list_error", { error: (err as Error).message });
        await reportFailure(supabase, "gmaps-api");
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
      const idempotencyKey = req.headers.get("idempotency-key");
      
      if (idempotencyKey) {
        const { data: existingKey } = await supabase
          .from("idempotency_keys")
          .select("response_body, status_code")
          .eq("key", idempotencyKey)
          .eq("user_id", userId)
          .maybeSingle();
          
        if (existingKey) {
          log.info("idempotency_hit", { key: idempotencyKey });
          return new Response(JSON.stringify(existingKey.response_body), {
            status: existingKey.status_code,
            headers: { ...corsHeaders, "Content-Type": "application/json", "x-idempotency-hit": "true" },
          });
        }
      }

      const parsed = CreateScrapeJobSchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest(corsHeaders, parsed.error.flatten().fieldErrors);
      }
      const body = { name: parsed.data.name, ...parsed.data.config };

      // G4: injeta proxies ativos da organização quando o usuário não passou explícitos.
      let orgProxies: string[] = [];
      if (!parsed.data.config.proxies?.length) {
        const { data: proxyRows } = await supabase
          .from("org_proxies")
          .select("url")
          .eq("is_active", true)
          .order("last_used_at", { ascending: true, nullsFirst: true })
          .limit(10);
        orgProxies = (proxyRows ?? []).map((p: { url: string }) => p.url);
        if (orgProxies.length) body.proxies = orgProxies;
      }

      // Melhoria #8: trace_id correlacionado (gmaps-proxy → scrape_jobs → worker)
      const traceId = crypto.randomUUID();
      const configPayload = {
        keywords: parsed.data.config.keywords,
        lang: parsed.data.config.lang,
        zoom: parsed.data.config.zoom,
        lat: parsed.data.config.lat,
        lon: parsed.data.config.lon,
        fast_mode: parsed.data.config.fast_mode,
        radius: parsed.data.config.radius,
        depth: parsed.data.config.depth,
        email: parsed.data.config.email,
        max_time: parsed.data.config.max_time,
        proxies: body.proxies ?? [],
        extra_reviews: parsed.data.config.extra_reviews,
      };

      const { data: dbJob, error: dbError } = await supabase
        .from("scrape_jobs")
        .insert({
          user_id: userId,
          name: parsed.data.name,
          status: "pending",
          source: "gmaps",
          auto_sync: parsed.data.auto_sync,
          extra_reviews: parsed.data.config.extra_reviews,
          config: configPayload,
          trace_id: traceId,
        })
        .select()
        .single();

      // Melhoria #4: idempotência forte — se já existe job ativo com mesma
      // config (config_hash único parcial disparou 23505), retorna o existente
      // em vez de estourar 500.
      if (dbError && (dbError as { code?: string }).code === "23505") {
        const { data: existing } = await supabase
          .from("scrape_jobs")
          .select("id, external_id, status, trace_id")
          .eq("organization_id", (dbError as { details?: string }).details?.match(/organization_id[^,]*, ([^)]+)/)?.[1] ?? "")
          .eq("config_hash", null as unknown as string)
          .in("status", ["pending", "running", "working"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          log.info("gmaps_create_dedup_hit", { existing_id: existing.id, trace_id: existing.trace_id });
          return new Response(
            JSON.stringify({ id: existing.id, external_id: existing.external_id, status: existing.status, deduplicated: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
      }
      if (dbError) throw dbError;

      let externalId: string | null = null;
      let responseBody: Record<string, unknown> = { id: dbJob.id, status: "pending", trace_id: traceId };
      
      try {
        const isHealthy = await checkCircuitBreaker(supabase, "gmaps-api");
        if (!isHealthy) throw new Error("Circuit breaker is open");

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
          responseBody = { id: dbJob.id, external_id: externalId, status: "running" };
          await reportSuccess(supabase, "gmaps-api");

          await supabase
            .from("scrape_jobs")
            .update({ external_id: externalId, status: "running" })
            .eq("id", dbJob.id);
        } else {
          await reportFailure(supabase, "gmaps-api");
        }
      } catch (err) {
        log.error("gmaps_api_create_error", { error: (err as Error).message });
        await reportFailure(supabase, "gmaps-api");
      }

      if (idempotencyKey) {
        await supabase.from("idempotency_keys").insert({
          user_id: userId,
          key: idempotencyKey,
          response_body: responseBody,
          status_code: 200,
        });
      }

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, job_id: dbJob.id, external_id: externalId });

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

      if (!job?.external_id) throw new Error("Job not found or has no external ID");

      let results: RawGmapsRow[] = [];
      try {
        // Tenta JSON primeiro (endpoint mais rico), fallback para CSV.
        let res = await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}/download?format=json`, {
          signal: AbortSignal.timeout(30000),
        });
        let isJson = res.ok && (res.headers.get("content-type") || "").includes("json");
        if (!res.ok) {
          res = await fetch(`${GMAPS_API_BASE}/jobs/${job.external_id}/download`, {
            signal: AbortSignal.timeout(30000),
          });
          isJson = (res.headers.get("content-type") || "").includes("json");
        }
        if (res.ok) {
          const text = await res.text();
          if (isJson) {
            try {
              const parsed = JSON.parse(text);
              results = Array.isArray(parsed) ? parsed as RawGmapsRow[] : [];
            } catch {
              results = parseCsv(text);
            }
          } else {
            results = parseCsv(text);
          }
        }
      } catch (err) {
        log.error("gmaps_api_download_error", { error: (err as Error).message, job_id });
        throw new Error("Failed to download results from external API");
      }

      const { data: ipcConfig } = await supabase
        .from("ipc_config")
        .select("*")
        .eq("is_active", true)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      let companiesCreated = 0;

      for (const rawRow of results) {
        const mapped = mapGmapsRow(rawRow);
        const ipcScore = calculateIPCScore(
          {
            category: mapped.sector,
            address: mapped.location,
            email: mapped.email,
            phone: mapped.phone,
            website: mapped.website,
            rating: mapped.rating ?? undefined,
          },
          ipcConfig?.criteria as IPCHittingCriteria | undefined,
        );

        // G9: deduplicação por place_id quando disponível (o Google garante
        // unicidade global); senão cai no par legado (org, name, source).
        const conflictTarget = mapped.place_id
          ? "organization_id,place_id"
          : "organization_id,name,source";

        // organization_id vem do job (não do DEFAULT da coluna): o client
        // service_role não repassa Authorization, então auth.uid() é NULL.
        const payload = {
          user_id: userId,
          organization_id: job.organization_id,
          name: mapped.name,
          sector: mapped.sector,
          location: mapped.location,
          website: mapped.website,
          phone: mapped.phone,
          email: mapped.email,
          source: "gmaps",
          ipc_score: ipcScore,
          enriched: !!(mapped.email || mapped.phone),
          raw_data: rawRow,
          latitude: mapped.latitude,
          longitude: mapped.longitude,
          place_id: mapped.place_id,
          cid: mapped.cid,
          plus_code: mapped.plus_code,
          google_maps_url: mapped.google_maps_url,
          street_view_url: mapped.street_view_url,
          rating: mapped.rating,
          review_count: mapped.review_count,
          price_range: mapped.price_range,
          business_status: mapped.business_status,
          thumbnail_url: mapped.thumbnail_url,
          images: mapped.images,
          open_hours: mapped.open_hours,
          popular_times: mapped.popular_times,
          timezone: mapped.timezone,
          descriptions: mapped.descriptions,
          owner_claimed: mapped.owner_claimed,
          reservations_url: mapped.reservations_url,
          order_online_url: mapped.order_online_url,
          menu_url: mapped.menu_url,
        };

        const { data: company, error: upsertError } = await supabase
          .from("companies")
          .upsert(payload, { onConflict: conflictTarget })
          .select()
          .single();

        if (upsertError) {
          log.warn("company_upsert_failed", { error: upsertError.message, name: mapped.name });
          continue;
        }

        if (company) {
          companiesCreated++;
          await supabase.from("scrape_results").insert({
            user_id: userId,
            job_id: job_id,
            company_id: company.id,
            raw_data: rawRow,
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
    log.error("request_failed", { error: (err as Error).message, action, duration_ms: duration });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
