import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { upsertCompanies } from "../_shared/companies-upsert.ts";
import { phaseEnabled } from "../_shared/workflow-phases.ts";

const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://promo-lux-v2.vercel.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:5173",
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

// ── Multi-tenant ──
// O client acima usa SERVICE_ROLE_KEY: ele ignora RLS e não tem `auth.uid()`,
// então o DEFAULT public.default_org_for_current_user() da coluna
// organization_id resolve para NULL e o INSERT viola o NOT NULL. Além disso,
// filtrar por user_id impedia um membro de executar/editar workflow criado por
// outro membro da mesma organização. A autorização real é: o chamador precisa
// ser membro da organização dona da linha, e o papel dele na organização define
// o que pode fazer (mesmas regras das policies de workflows.
const ROLE_RANK: Record<string, number> = { viewer: 0, sdr: 1, admin: 2 };

interface CallerOrg {
  organization_id: string;
  role: string;
}

/** Organizações do usuário, com o papel dele em cada uma. */
async function listCallerOrgs(admin: SupabaseClient, userId: string): Promise<CallerOrg[]> {
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    organization_id: (r as { organization_id: string }).organization_id,
    role: (r as { role: string }).role,
  }));
}

/** Papel do usuário numa organização específica (null = não é membro). */
async function callerRoleIn(admin: SupabaseClient, userId: string, organizationId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { role: string }).role;
}

function hasMinRole(role: string | null, minRole: string): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[minRole] ?? 99);
}

function forbidden(corsHeaders: Record<string, string>, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notFound(corsHeaders: Record<string, string>, message = "Workflow not found") {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Schemas ──

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(""),
  steps: z.array(z.record(z.unknown())).min(1).max(20),
  config: z.record(z.unknown()).default({}),
  /** Org alvo; se omitida usa a primeira organização do usuário. */
  organization_id: z.string().uuid("Invalid organization_id").optional(),
});

const RunWorkflowSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow_id"),
});

const ToggleStatusSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow_id"),
  new_status: z.enum(["active", "paused", "draft"]),
});

const ActionSchema = z.enum(["list", "create", "run", "retry-step", "toggle-status", "delete"]);

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
      const orgs = await listCallerOrgs(supabase, userId);
      if (orgs.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("workflows")
        .select("*, workflow_runs(id, status, started_at, completed_at, results)")
        .in("organization_id", orgs.map((o) => o.organization_id))
        .is("deleted_at", null)
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

      // organization_id é NOT NULL e o service_role não tem auth.uid(), logo o
      // DEFAULT da coluna retorna NULL. A org vem da requisição (quando enviada)
      // e SEMPRE é validada contra a membership do chamador.
      const orgs = await listCallerOrgs(supabase, userId);
      const requestedOrgId = body.organization_id ?? null;
      const targetOrg = requestedOrgId
        ? orgs.find((o) => o.organization_id === requestedOrgId)
        : orgs[0];

      if (!targetOrg) {
        return forbidden(
          corsHeaders,
          requestedOrgId ? "Not a member of the requested organization" : "User has no organization",
        );
      }
      if (!hasMinRole(targetOrg.role, "sdr")) {
        return forbidden(corsHeaders, "Requires sdr or admin role in the organization");
      }

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          user_id: userId,
          organization_id: targetOrg.organization_id,
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

    // RETRY step
    if (action === "retry-step" && req.method === "POST") {
      const { step_id } = await req.json();
      if (!step_id) return badRequest(corsHeaders, { step_id: "Required" });

      const { data: step, error: stepError } = await supabase
        .from("automation_steps")
        .select("id, name, job_id, run_id, organization_id")
        .eq("id", step_id)
        .maybeSingle();

      if (stepError) throw stepError;
      if (!step) return notFound(corsHeaders, "Step not found");

      // Steps de workflow pertencem a um run e nao a um scrape_job — o org vem da
      // propria linha, nao do join. `scrape_jobs(...)` vinha null e estourava 500.
      const stepOrgId = step.organization_id;
      if (!stepOrgId) return new Response(JSON.stringify({ error: "Step sem organizacao" }), { status: 422, headers: corsHeaders });

      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", stepOrgId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!hasMinRole((membership as { role?: string } | null)?.role ?? null, "sdr")) {
        return forbidden(corsHeaders, "Requires sdr or admin role in the step organization");
      }

      // Steps de workflow (run_id) nao sao consumidos por worker externo:
      // apenas marcar "pending" fazia a UI anunciar "reiniciado" com o
      // trabalho nunca refeito. As fases vivem dentro do action=run, entao
      // reexecutamos o run reaproveitando o token do proprio caller (a
      // autorizacao e revalidada na entrada do run, sem service_role extra).
      if (step.run_id) {
        const { data: runRow, error: runErr } = await supabase
          .from("workflow_runs")
          .select("workflow_id")
          .eq("id", step.run_id)
          .maybeSingle();
        if (runErr) throw runErr;
        if (!runRow?.workflow_id) return notFound(corsHeaders, "Run do step nao encontrado");

        await supabase.from("automation_steps").update({
          status: "pending",
          error_stack: null,
          message: "Reexecucao solicitada pelo usuario",
          started_at: null,
          completed_at: null,
        }).eq("id", step_id);

        const retryRes = await fetch(`${supabaseUrl}/functions/v1/workflow-engine?action=run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ workflow_id: runRow.workflow_id }),
        });
        const retryBody = await retryRes.json().catch(() => ({}));
        if (!retryRes.ok) {
          return new Response(JSON.stringify({ error: retryBody?.error ?? "Falha ao reexecutar o workflow" }), {
            status: retryRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        log.info("step_retry_rerun", { step_id, run_id: step.run_id, workflow_id: runRow.workflow_id });
        return new Response(JSON.stringify({ success: true, message: "Workflow reexecutado", run_id: retryBody?.run_id ?? null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Steps de scrape (job_id) seguem o fluxo do worker externo de gmaps.
      await supabase.from("automation_steps").update({
        status: "pending",
        error_stack: null,
        message: "Reiniciado pelo usuario",
        started_at: new Date().toISOString(),
        completed_at: null
      }).eq("id", step_id);

      log.info("step_retry_triggered", { step_id, step_name: step.name, job_id: step.job_id });

      return new Response(JSON.stringify({ success: true, message: "Etapa reiniciada" }), {
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
        .is("deleted_at", null)
        .maybeSingle();
      if (wfError) throw wfError;
      if (!workflow) return notFound(corsHeaders);

      // service_role ignora RLS: a autorização é revalidada aqui.
      const role = await callerRoleIn(supabase, userId, workflow.organization_id);
      if (!hasMinRole(role, "sdr")) {
        return forbidden(corsHeaders, "Requires sdr or admin role in the workflow organization");
      }

      log.info("workflow_run_start", { workflow_id, workflow_name: workflow.name });

      // Audit Log: Execution started
      await supabase.from("audit_logs").insert({
        action: "workflow_execution_started",
        table_name: "workflows",
        record_id: workflow_id,
        actor_id: userId,
        organization_id: workflow.organization_id,
        metadata: { workflow_name: workflow.name }
      });

      // Create run record
      const { data: run, error: runError } = await supabase
        .from("workflow_runs")
        .insert({ 
          workflow_id, 
          user_id: userId, 
          organization_id: workflow.organization_id,
          status: "running", 
          current_step: "scrape" 
        })
        .select()
        .single();
      if (runError) throw runError;

      await supabase
        .from("workflows")
        .update({ status: "active", last_run_at: new Date().toISOString() })
        .eq("id", workflow_id);

      const config = workflow.config as Record<string, unknown>;
      const results: Record<string, unknown> = { summary: {} };

      // ===== STEP 1: SCRAPE =====
      await supabase.from("workflow_runs").update({ current_step: "scrape" }).eq("id", run.id);

      let scrapeJobId: string | null = null;
      
      const insertStep = async (name: string, message: string, payload?: unknown) => {
        return await supabase.from("automation_steps").insert({
          job_id: scrapeJobId,
          run_id: run.id,
          organization_id: workflow.organization_id,
          name,
          message,
          payload,
          status: "running"
        }).select().single();
      };

      const updateStep = async (stepId: string, status: string, message?: string, payload?: unknown, errorStack?: string) => {
        return await supabase.from("automation_steps").update({
          status,
          message,
          payload,
          error_stack: errorStack,
          completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
        }).eq("id", stepId);
      };

      if (!phaseEnabled(workflow.steps, "scrape")) {
        results.scrape = { status: "skipped" };
      } else {
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
              organization_id: workflow.organization_id,
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

          const stepInit = await insertStep("Inicialização", "Preparando ambiente e parâmetros de busca", { keywords, radius, depth });
        
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
              if (stepInit.data) await updateStep(stepInit.data.id, "completed", "Ambiente preparado com sucesso", { external_id: externalId });
            } else {
              const errText = await res.text();
              if (stepInit.data) await updateStep(stepInit.data.id, "failed", "Falha ao iniciar job externo", { status: res.status, error: errText });
            }
          } catch (err) {
            log.error("step_scrape_api_error", { error: (err as Error).message, workflow_id });
            if (stepInit.data) await updateStep(stepInit.data.id, "failed", "Erro de conexão com API externa", null, (err as Error).stack);
          }

          const stepSearch = await insertStep("Busca de Leads", "Iniciando busca no Google Maps", { external_id: externalId });

          if (scrapeJobId) {
            await supabase
              .from("scrape_jobs")
              .update({ external_id: externalId, status: externalId ? "running" : "failed" })
              .eq("id", scrapeJobId);
          }

          if (externalId && stepSearch.data) {
            await updateStep(stepSearch.data.id, "completed", "Busca iniciada remotamente", { external_id: externalId });
          } else if (stepSearch.data) {
            await updateStep(stepSearch.data.id, "failed", "Não foi possível obter ID externo para busca");
          }

          results.scrape = {
            job_id: scrapeJobId,
            external_id: externalId,
            status: externalId ? "submitted" : "failed",
            keywords,
          };
        } catch (err) {
          log.error("step_scrape_error", { error: (err as Error).message, workflow_id });
          results.scrape = { error: (err as Error).message };
        }
      }

      // ===== STEP 2: ENRICH =====
      await supabase.from("workflow_runs").update({ current_step: "enrich" }).eq("id", run.id);
      let enrichedCount = 0;
      if (!phaseEnabled(workflow.steps, "enrich")) {
        results.enrich = { status: "skipped" };
      } else {

        const stepEnrich = await insertStep("Enriquecimento", "Iniciando processamento e extração de dados");
        try {
          const { data: completedJobs } = await supabase
            .from("scrape_jobs")
            .select("id, external_id")
            .eq("status", "completed")
            .eq("source", "gmaps")
            .eq("organization_id", workflow.organization_id)
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

                const batchCompanies: Record<string, unknown>[] = [];
                const batchRawData: Record<string, string>[] = [];

                for (let li = 1; li < lines.length; li++) {
                  const values = lines[li].split(",").map((v: string) => v.trim().replace(/"/g, ""));
                  const obj: Record<string, string> = {};
                  headers.forEach((h: string, i: number) => { obj[h] = values[i] || ""; });

                  batchCompanies.push({
                    user_id: userId,
                    organization_id: workflow.organization_id,
                    name: obj.name || obj.title || "Unknown",
                    sector: obj.category || obj.type || "Não classificado",
                    location: obj.address || obj.city || "",
                    website: obj.website || obj.web_site || "",
                    phone: obj.phone || "",
                    email: obj.email || "",
                    source: "gmaps",
                    enriched: !!(obj.email || obj.phone),
                    raw_data: obj,
                  });
                  batchRawData.push(obj);
                }

                if (batchCompanies.length > 0) {
                  // upsert (não insert): um único name+source repetido no lote —
                  // ou já existente na org — antes abortava o INSERT inteiro por
                  // violar a constraint única, descartando silenciosamente todo o
                  // resto do lote (0 empresas importadas, só logado). Upsert com
                  // onConflict mescla a duplicata em vez de derrubar o lote.
                  // upsertCompanies resolve o indice unico que o banco alvo
                  // realmente tem. Fixar onConflict aqui quebrava em 42P10 quando
                  // o schema estava com indice parcial e o lote inteiro era
                  // descartado (0 empresas importadas, so logado).
                  const { data: insertedCompanies, error: insError } = await upsertCompanies(
                    supabase,
                    batchCompanies,
                    { hasPlaceId: false },
                  );

                  if (insError) {
                    log.error("bulk_company_insert_failed", { error: insError.message });
                    continue;
                  }

                  if (insertedCompanies) {
                    const resultsToInsert = insertedCompanies.map((c, idx) => ({
                      user_id: userId,
                      organization_id: workflow.organization_id,
                      job_id: job.id,
                      company_id: c.id,
                      raw_data: batchRawData[idx],
                      processed: false,
                    }));

                    const { error: resError } = await supabase.from("scrape_results").insert(resultsToInsert);
                    if (resError) log.error("bulk_results_insert_failed", { error: resError.message });
                    enrichedCount += insertedCompanies.length;
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

          if (stepEnrich.data) await updateStep(stepEnrich.data.id, "completed", `Enriquecimento concluído: ${enrichedCount} empresas processadas`, { count: enrichedCount });
          results.enrich = { companies_imported: enrichedCount, status: "completed" };
        } catch (err) {
          log.error("step_enrich_error", { error: (err as Error).message, workflow_id });
          if (stepEnrich.data) await updateStep(stepEnrich.data.id, "failed", "Falha durante enriquecimento", null, (err as Error).stack);
          results.enrich = { error: (err as Error).message };
        }
      }

      // ===== STEP 3: IPC SCORING =====
      await supabase.from("workflow_runs").update({ current_step: "ipc_score" }).eq("id", run.id);
      let scoredCount = 0;
      if (!phaseEnabled(workflow.steps, "ipc_score")) {
        results.ipc_score = { status: "skipped" };
      } else {

        const stepIPC = await insertStep("Qualificação IPC", "Calculando pontuação de leads qualificados");
        try {
          const { data: ipcConfig } = await supabase
            .from("ipc_config")
            .select("*")
            .eq("is_active", true)
            .eq("organization_id", workflow.organization_id)
            .limit(1)
            .maybeSingle();

          const criteria = (ipcConfig?.criteria || {}) as Record<string, unknown>;
          const criterSectors = (criteria.sectors || []) as string[];
          const criterLocations = (criteria.locations || []) as string[];

          const { data: unscoredCompanies } = await supabase
            .from("companies")
            .select("*")
            .eq("ipc_score", 0)
            .eq("organization_id", workflow.organization_id)
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

              await supabase.from("companies").update({ ipc_score: score }).eq("id", company.id);
              scoredCount++;
            }
          }

          const { data: unprocessedResults } = await supabase
            .from("scrape_results")
            .select("id")
            .eq("processed", false)
            .eq("organization_id", workflow.organization_id)
            .limit(500);

          if (unprocessedResults && unprocessedResults.length > 0) {
            const ids = unprocessedResults.map(r => r.id);
            await supabase.from("scrape_results").update({ processed: true }).in("id", ids);
          }

          if (stepIPC.data) await updateStep(stepIPC.data.id, "completed", `Qualificação concluída: ${scoredCount} empresas pontuadas`, { count: scoredCount });
          results.ipc_score = { companies_scored: scoredCount, status: "completed" };
        } catch (err) {
          log.error("step_ipc_score_error", { error: (err as Error).message, workflow_id });
          if (stepIPC.data) await updateStep(stepIPC.data.id, "failed", "Falha durante pontuação IPC", null, (err as Error).stack);
          results.ipc_score = { error: (err as Error).message };
        }
      }

      // ===== STEP 4: FINALIZE =====
      const stepFinal = await insertStep("Finalização", "Sincronizando resultados finais");
      await supabase.from("workflow_runs").update({ current_step: "save" }).eq("id", run.id);

      const { count: qualifiedCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("ipc_score", 70)
        .eq("organization_id", workflow.organization_id);

      const { count: totalCount } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", workflow.organization_id);

      const totalProcessed = totalCount || 0;
      const totalQualified = qualifiedCount || 0;
      const successRate = totalProcessed > 0
        ? Math.round((totalQualified / totalProcessed) * 100)
        : 0;

      await supabase
        .from("workflows")
        .update({ leads_processed: totalProcessed, leads_qualified: totalQualified, success_rate: successRate })
        .eq("id", workflow_id);

      const summary = { total_companies: totalProcessed, qualified: totalQualified, success_rate: successRate };
      results.summary = summary;

      if (stepFinal.data) await updateStep(stepFinal.data.id, "completed", "Execução finalizada com sucesso", { total: totalProcessed, qualified: totalQualified });

      await supabase
        .from("workflow_runs")
        .update({ status: "completed", current_step: null, results, completed_at: new Date().toISOString() })
        .eq("id", run.id);

      const duration = Math.round(performance.now() - start);
      log.info("workflow_run_complete", {
        workflow_id, run_id: run.id, duration_ms: duration,
        enriched: enrichedCount, scored: scoredCount, qualified: totalQualified,
      });

      // Audit Log: Execution completed
      await supabase.from("audit_logs").insert({
        action: "workflow_execution_completed",
        table_name: "workflows",
        record_id: workflow_id,
        actor_id: userId,
        organization_id: workflow.organization_id,
        metadata: { ...summary, enriched: enrichedCount }
      });

      // Notification/Alert check
      const { data: alertConfig } = await supabase
        .from("automation_alerts")
        .select("*")
        .eq("user_id", userId)
        .eq("event_type", "job_completed")
        .eq("is_active", true)
        .maybeSingle();

      if (alertConfig) {
        log.info("trigger_alert", { type: "job_completed", user_id: userId });
        // In a real scenario, we'd trigger an email function or push notification here
      }

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

      const { data: wf, error: wfLookupError } = await supabase
        .from("workflows")
        .select("id, organization_id")
        .eq("id", workflow_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (wfLookupError) throw wfLookupError;
      if (!wf) return notFound(corsHeaders);

      const role = await callerRoleIn(supabase, userId, wf.organization_id);
      if (!hasMinRole(role, "sdr")) {
        return forbidden(corsHeaders, "Requires sdr or admin role in the workflow organization");
      }

      const { error } = await supabase
        .from("workflows")
        .update({ status: new_status })
        .eq("id", workflow_id);
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, workflow_id, new_status });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE workflow
    if (action === "delete" && (req.method === "POST" || req.method === "DELETE")) {
      // A UI chama com DELETE + ?id=; a API antiga mandava POST + { workflow_id }.
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      const workflow_id = body.workflow_id ?? url.searchParams.get("id");
      if (!workflow_id || !z.string().uuid().safeParse(workflow_id).success) {
        return badRequest(corsHeaders, { workflow_id: "Valid UUID required" });
      }

      const { data: wf, error: wfLookupError } = await supabase
        .from("workflows")
        .select("id, organization_id")
        .eq("id", workflow_id)
        .maybeSingle();
      if (wfLookupError) throw wfLookupError;
      if (!wf) return notFound(corsHeaders);

      // DELETE de workflow exige admin da org (mesma regra da policy
      // "Admins delete workflows").
      const role = await callerRoleIn(supabase, userId, wf.organization_id);
      if (!hasMinRole(role, "admin")) {
        return forbidden(corsHeaders, "Requires admin role in the workflow organization");
      }

      // Soft delete (ADR-008): o registro vai para a lixeira por 30 dias em vez
      // de sumir. Hard delete só no expurgo (purge_soft_deleted).
      const { error } = await supabase
        .from("workflows")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", workflow_id);
      if (error) throw error;

      const duration = Math.round(performance.now() - start);
      log.info("request_complete", { action, duration_ms: duration, workflow_id });

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

    // Try to notify failure
    try {
      const { data: alertConfig } = await supabase
        .from("automation_alerts")
        .select("*")
        .eq("user_id", userId)
        .eq("event_type", "job_failed")
        .eq("is_active", true)
        .maybeSingle();
      
      if (alertConfig) {
        log.info("trigger_failure_alert", { user_id: userId });
      }
    } catch (_) { /* best-effort: falha ao disparar alerta não deve mascarar o erro original */ }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
