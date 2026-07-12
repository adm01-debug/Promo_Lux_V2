import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * scrape-queue-worker
 * -------------------
 * Consumidor da fila de scraping. Reserva tarefas devidas (claim_scrape_tasks),
 * executa a criação do job na API externa do GMaps e reporta o resultado:
 *  - sucesso            -> complete_scrape_task
 *  - erro transitório   -> fail_scrape_task(transient=true)  => backoff exponencial
 *  - erro permanente    -> fail_scrape_task(transient=false) => dead-letter imediato
 *
 * Projetado para ser chamado periodicamente por cron (pg_cron + pg_net).
 */

const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";
const BATCH_SIZE = 5;
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  console[level === "info" ? "log" : level](
    JSON.stringify({ function: "scrape-queue-worker", worker: WORKER_ID, level, msg, ...data, ts: new Date().toISOString() }),
  );
}

/**
 * Grava um log de auditoria detalhado da execução (job, tenant, etapa, causa).
 * Nunca deixa uma falha de auditoria derrubar o processamento da tarefa.
 */
async function audit(
  supabase: ReturnType<typeof createClient>,
  task: QueueTask,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc("log_automation_event", {
      _organization_id: task.organization_id,
      _source: task.source ?? "gmaps",
      _scrape_job_id: task.scrape_job_id,
      _queue_task_id: task.id,
      _worker_id: WORKER_ID,
      _correlation_id: task.id,
      _max_attempts: task.max_attempts,
      _step_name: "scrape.create_job",
      ...fields,
    });
  } catch (e) {
    log("warn", "audit_log_failed", { task_id: task.id, error: (e as Error).message });
  }
}

/** Classifica se um erro deve ser retentado (transitório) ou não (permanente). */
function isTransient(status: number | null, err?: unknown): boolean {
  if (status === null) return true; // rede/timeout/abort => transitório
  if (status === 408 || status === 425 || status === 429) return true; // throttle/timeout
  if (status >= 500) return true; // falha do servidor externo
  return false; // 4xx (400/401/403/404/422...) => permanente
}

interface QueueTask {
  id: string;
  organization_id: string;
  user_id: string;
  scrape_job_id: string | null;
  source: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

async function processTask(supabase: ReturnType<typeof createClient>, task: QueueTask): Promise<void> {
  const cfg = (task.payload ?? {}) as Record<string, unknown>;

  if (task.scrape_job_id) {
    await supabase.from("scrape_jobs")
      .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", task.scrape_job_id);
  }

  let res: Response;
  try {
    res = await fetch(`${GMAPS_API_BASE}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cfg.name,
        keywords: cfg.keywords,
        lang: cfg.lang,
        zoom: cfg.zoom,
        lat: cfg.lat,
        lon: cfg.lon,
        fast_mode: cfg.fast_mode,
        radius: cfg.radius,
        depth: cfg.depth,
        email: cfg.email,
        max_time: cfg.max_time,
        proxies: cfg.proxies,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Rede/timeout => transitório
    const message = `network_error: ${(err as Error).message}`;
    const result = await supabase.rpc("fail_scrape_task", { _id: task.id, _error: message, _transient: true });
    log("warn", "task_transient_network_fail", { task_id: task.id, attempts: task.attempts + 1, next: result.data });
    return;
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const transient = isTransient(res.status);
    const message = `http_${res.status}: ${bodyText.slice(0, 500)}`;
    const result = await supabase.rpc("fail_scrape_task", { _id: task.id, _error: message, _transient: transient });
    log("warn", "task_http_fail", { task_id: task.id, status: res.status, transient, outcome: result.data });
    return;
  }

  // Sucesso: registra external_id no job vinculado.
  const data = await res.json().catch(() => ({}));
  const externalId = (data?.id ?? data?.ID ?? null) as string | null;
  if (task.scrape_job_id) {
    await supabase.from("scrape_jobs")
      .update({ external_id: externalId, status: "running", updated_at: new Date().toISOString() })
      .eq("id", task.scrape_job_id);
  }
  await supabase.rpc("complete_scrape_task", { _id: task.id });
  log("info", "task_succeeded", { task_id: task.id, external_id: externalId });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const start = performance.now();
  try {
    const { data: tasks, error } = await supabase.rpc("claim_scrape_tasks", {
      _limit: BATCH_SIZE,
      _worker: WORKER_ID,
    });
    if (error) throw error;

    const claimed = (tasks ?? []) as QueueTask[];
    log("info", "batch_claimed", { count: claimed.length });

    // Processa em paralelo — cada tarefa isola seu próprio erro.
    const results = await Promise.allSettled(claimed.map((t) => processTask(supabase, t)));
    const failed = results.filter((r) => r.status === "rejected").length;

    // Salvaguarda: se processTask lançar antes de reportar, marca como falha transitória.
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        const reason = (results[i] as PromiseRejectedResult).reason;
        await supabase.rpc("fail_scrape_task", {
          _id: claimed[i].id,
          _error: `worker_exception: ${String(reason).slice(0, 500)}`,
          _transient: true,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: claimed.length,
        failed_unexpectedly: failed,
        duration_ms: Math.round(performance.now() - start),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log("error", "worker_error", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
