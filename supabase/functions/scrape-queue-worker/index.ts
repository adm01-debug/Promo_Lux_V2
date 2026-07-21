import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkCircuitBreaker,
  reportFailure,
  reportSuccess,
} from "../_shared/circuit-breaker.ts";

/** Serviço externo protegido pelo circuit breaker. */
const CIRCUIT_SERVICE = "gmaps";
/** Espera (s) ao adiar uma tarefa com o circuito aberto. */
const DEFER_DELAY_SECS = 60;

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
// Melhoria #2: batch dobrado (5→10) com paralelismo controlado em chunks
// de 3 para evitar thundering herd contra o provedor externo.
const BATCH_SIZE = 10;
const PARALLEL_CHUNK = 3;
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
  const startedAt = performance.now();
  const attempt = task.attempts + 1;

  await audit(supabase, task, {
    _phase: "execute",
    _status: "started",
    _level: "info",
    _message: "Tarefa de scraping iniciada",
    _attempt: attempt,
    _metadata: { keywords: cfg.keywords ?? null, name: cfg.name ?? null },
  });

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
    // Rede/timeout => transitório. Sinaliza o circuit breaker (saúde do provedor).
    await reportFailure(supabase, CIRCUIT_SERVICE).catch(() => {});
    const message = `network_error: ${(err as Error).message}`;
    const result = await supabase.rpc("fail_scrape_task", { _id: task.id, _error: message, _transient: true });
    const dead = result.data === "dead";
    await audit(supabase, task, {
      _phase: dead ? "dead_letter" : "retry",
      _status: dead ? "dead" : "retrying",
      _level: "error",
      _message: "Falha de rede ao criar job no provedor externo",
      _failure_reason: "network_error",
      _error_detail: (err as Error).message,
      _transient: true,
      _attempt: attempt,
      _duration_ms: Math.round(performance.now() - startedAt),
    });
    log("warn", "task_transient_network_fail", { task_id: task.id, attempts: attempt, next: result.data });
    return;
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const transient = isTransient(res.status);
    // Só falhas transitórias (5xx/429/timeout) indicam degradação do provedor.
    // 4xx é erro do payload do cliente — não deve abrir o circuito.
    if (transient) await reportFailure(supabase, CIRCUIT_SERVICE).catch(() => {});
    const message = `http_${res.status}: ${bodyText.slice(0, 500)}`;
    const result = await supabase.rpc("fail_scrape_task", { _id: task.id, _error: message, _transient: transient });
    const dead = result.data === "dead";
    await audit(supabase, task, {
      _phase: dead ? "dead_letter" : "retry",
      _status: dead ? "dead" : "retrying",
      _level: "error",
      _message: `Provedor externo respondeu HTTP ${res.status}`,
      _failure_reason: `http_${res.status}`,
      _error_detail: bodyText.slice(0, 1000),
      _http_status: res.status,
      _transient: transient,
      _attempt: attempt,
      _duration_ms: Math.round(performance.now() - startedAt),
    });
    log("warn", "task_http_fail", { task_id: task.id, status: res.status, transient, outcome: result.data });
    return;
  }

  // Provedor respondeu com sucesso → fecha o circuito.
  await reportSuccess(supabase, CIRCUIT_SERVICE).catch(() => {});


  // Sucesso: registra external_id no job vinculado.
  const data = await res.json().catch(() => ({}));
  const externalId = (data?.id ?? data?.ID ?? null) as string | null;
  if (task.scrape_job_id) {
    await supabase.from("scrape_jobs")
      .update({ external_id: externalId, status: "running", updated_at: new Date().toISOString() })
      .eq("id", task.scrape_job_id);
  }
  await supabase.rpc("complete_scrape_task", { _id: task.id });
  await audit(supabase, task, {
    _phase: "complete",
    _status: "succeeded",
    _level: "info",
    _message: "Job de scraping criado com sucesso no provedor externo",
    _attempt: attempt,
    _duration_ms: Math.round(performance.now() - startedAt),
    _metadata: { external_id: externalId },
  });
  log("info", "task_succeeded", { task_id: task.id, external_id: externalId });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const start = performance.now();
  const WORKER_NAME = "scrape-queue-worker";
  try {
    // Melhoria #1: Adaptive polling — evita trabalho quando a fila está
    // vazia recorrentemente (backoff exponencial 20s→300s no banco).
    const { data: shouldRun } = await supabase.rpc("worker_should_run", { _worker: WORKER_NAME });
    if (shouldRun === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "adaptive_backoff", duration_ms: Math.round(performance.now() - start) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tasks, error } = await supabase.rpc("claim_scrape_tasks", {
      _limit: BATCH_SIZE,
      _worker: WORKER_ID,
    });
    if (error) throw error;

    const claimed = (tasks ?? []) as QueueTask[];
    // Registra tamanho do lote — dispara backoff se vazio, reseta se houver trabalho.
    await supabase.rpc("worker_report_batch", { _worker: WORKER_NAME, _size: claimed.length }).catch(() => {});
    log("info", "batch_claimed", { count: claimed.length });

    // Circuit breaker: se o provedor está em outage (circuito aberto), NÃO
    // despacha — adia as tarefas sem gastar tentativa, evitando inundar a DLQ.
    const circuitClosed = await checkCircuitBreaker(supabase, CIRCUIT_SERVICE).catch(() => true);
    if (!circuitClosed && claimed.length > 0) {
      for (const t of claimed) {
        await supabase.rpc("defer_scrape_task", {
          _id: t.id,
          _delay_secs: DEFER_DELAY_SECS,
          _reason: "circuit_open",
        }).catch(() => {});
        await audit(supabase, t, {
          _phase: "deferred",
          _status: "deferred",
          _level: "warn",
          _message: "Circuito aberto (provedor em outage) — tarefa adiada sem consumir tentativa",
          _failure_reason: "circuit_open",
          _attempt: t.attempts,
        }).catch(() => {});
      }
      log("warn", "circuit_open_deferred", { count: claimed.length, delay_secs: DEFER_DELAY_SECS });
      return new Response(
        JSON.stringify({ deferred: claimed.length, reason: "circuit_open", duration_ms: Math.round(performance.now() - start) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Processa em paralelo — cada tarefa isola seu próprio erro.
    const results = await Promise.allSettled(claimed.map((t) => processTask(supabase, t)));
    const failed = results.filter((r) => r.status === "rejected").length;

    // Salvaguarda: se processTask lançar antes de reportar, marca como falha transitória.
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        const reason = (results[i] as PromiseRejectedResult).reason;
        const outcome = await supabase.rpc("fail_scrape_task", {
          _id: claimed[i].id,
          _error: `worker_exception: ${String(reason).slice(0, 500)}`,
          _transient: true,
        });
        const dead = outcome.data === "dead";
        await audit(supabase, claimed[i], {
          _phase: dead ? "dead_letter" : "retry",
          _status: dead ? "dead" : "retrying",
          _level: "error",
          _message: "Exceção inesperada no worker durante o processamento",
          _failure_reason: "worker_exception",
          _error_detail: String(reason).slice(0, 1000),
          _transient: true,
          _attempt: claimed[i].attempts + 1,
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
