// web-scrape-worker
// -----------------
// Consumidor da fila `web_scrape_queue`. Executa fetch HTTP puro, respeita
// robots.txt (com cache), converte HTML→Markdown, detecta SPA shell vazio,
// e reporta sucesso/falha via RPCs `complete_web_scrape_task`,
// `fail_web_scrape_task` e `defer_web_scrape_task` (para circuit breaker
// aberto). Isolado do motor GMaps — reusa apenas a malha compartilhada
// (circuit-breaker, ssrf-guard, tracing).
//
// Ordem por task:
//   1) SSRF guard (rejeita URLs privadas)
//   2) Circuit breaker por hostname → defer 60s se aberto
//   3) robots.txt (cache 24h em robots_cache) → fail permanente se bloqueado
//   4) fetch com AbortController(timeout) + max_bytes + até 5 redirects
//   5) Detecta SPA shell vazio → fail permanente (spa_empty_shell)
//   6) Extrai title/description/markdown/links + grava web_scrape_results
//   7) complete_web_scrape_task(result_id)
//
// Todos os logs são JSON estruturado com trace_id + correlation_id.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  checkCircuitBreaker,
  reportFailure,
  reportSuccess,
} from "../_shared/circuit-breaker.ts";
import { parseRobotsTxt, isAllowed, type RobotsPolicy } from "../_shared/web-scrape/robots.ts";
import { extractContent } from "../_shared/web-scrape/html-to-markdown.ts";
import { isEmptyShell, isTransientHttp, hostnameOf } from "../_shared/web-scrape/heuristics.ts";
import { shouldInjectChaos } from "../_shared/web-scrape/chaos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 8;
const PARALLEL_CHUNK = 3;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const ROBOTS_TTL_HOURS = 24;
const WORKER_ID = `web-worker-${crypto.randomUUID().slice(0, 8)}`;
const USER_AGENT = "lux-web-scraper/1.0 (+https://lux-ai-finder.lovable.app)";

interface QueueTask {
  id: string;
  organization_id: string;
  user_id: string;
  url: string;
  formats: string[];
  extract_schema: unknown | null;
  wait_for_ms: number;
  max_bytes: number;
  trace_id: string;
  attempts: number;
  max_attempts: number;
}

function log(level: "info" | "warn" | "error", msg: string, data: Record<string, unknown> = {}) {
  console[level === "info" ? "log" : level](
    JSON.stringify({
      function: "web-scrape-worker",
      worker: WORKER_ID,
      level,
      msg,
      ...data,
      ts: new Date().toISOString(),
    }),
  );
}

// ---------- robots cache ----------

async function getRobotsPolicy(supabase: SupabaseClient, host: string, origin: string): Promise<RobotsPolicy> {
  const { data } = await supabase
    .from("robots_cache")
    .select("*")
    .eq("host", host)
    .maybeSingle();

  const now = Date.now();
  if (data) {
    const fetchedAt = new Date((data as { fetched_at: string }).fetched_at).getTime();
    if (now - fetchedAt < ROBOTS_TTL_HOURS * 3600_000) {
      return parseRobotsTxt((data as { body: string }).body ?? "", "lux-web-scraper");
    }
  }

  // Miss ou expirado: refetch.
  let body = "";
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, 5_000, 200_000);
    if (res.ok) body = await res.text();
  } catch (e) {
    log("warn", "robots_fetch_failed", { host, error: (e as Error).message });
  }

  await supabase
    .from("robots_cache")
    .upsert({ host, body, fetched_at: new Date().toISOString() }, { onConflict: "host" });

  return parseRobotsTxt(body, "lux-web-scraper");
}

// ---------- fetch helper ----------

async function fetchWithTimeout(url: string, timeoutMs: number, maxBytes: number): Promise<Response & { _bytes?: number; _finalUrl?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let currentUrl = url;
    let res: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(currentUrl, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        try {
          await res.body?.cancel();
        } catch { /* noop */ }
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }
      break;
    }
    if (!res) throw new Error("no_response");
    (res as Response & { _finalUrl?: string })._finalUrl = currentUrl;
    // max_bytes guard: consumimos em stream até o teto.
    return res as Response & { _bytes?: number; _finalUrl?: string };
  } finally {
    clearTimeout(t);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; bytes: number; partial: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", bytes: 0, partial: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let partial = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        partial = true;
        try {
          await reader.cancel();
        } catch { /* noop */ }
        break;
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total > maxBytes ? maxBytes : total);
  let off = 0;
  for (const c of chunks) {
    if (off + c.byteLength > buf.byteLength) {
      buf.set(c.subarray(0, buf.byteLength - off), off);
      break;
    }
    buf.set(c, off);
    off += c.byteLength;
  }
  const contentType = res.headers.get("content-type") ?? "";
  const charsetMatch = /charset=([^;]+)/i.exec(contentType);
  const charset = (charsetMatch?.[1] ?? "utf-8").trim().toLowerCase();
  const decoder = new TextDecoder(charset === "utf8" ? "utf-8" : charset, { fatal: false });
  return { text: decoder.decode(buf), bytes: total, partial };
}

// ---------- SSRF (mínimo, sem DNS async pra evitar custo por task) ----------

function isSafeUrl(url: string): { ok: true } | { ok: false; reason: string } {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "invalid_scheme" };
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0") return { ok: false, reason: "private_host" };
    // IPv4 literais em faixa privada
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [, a, b] = ipv4;
      const na = Number(a), nb = Number(b);
      if (na === 10 || na === 127 || (na === 169 && nb === 254) || (na === 172 && nb >= 16 && nb <= 31) || (na === 192 && nb === 168)) {
        return { ok: false, reason: "private_ip" };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
}

// ---------- processamento de uma task ----------

async function processTask(supabase: SupabaseClient, task: QueueTask, chaosEnabled: boolean) {
  const started = Date.now();
  const traceId = task.trace_id;
  const log2 = (level: "info" | "warn" | "error", msg: string, data: Record<string, unknown> = {}) =>
    log(level, msg, { task_id: task.id, trace_id: traceId, url: task.url, ...data });

  // Chaos: 1% de falha sintética (determinística por task_id, auditada).
  if (chaosEnabled && shouldInjectChaos(task.id, 0.01)) {
    log2("warn", "chaos_injected");
    await supabase.from("automation_execution_logs").insert({
      organization_id: task.organization_id,
      user_id: task.user_id,
      queue_task_id: task.id,
      source: "chaos",
      phase: "fail",
      status: "failed",
      level: "warn",
      message: "Chaos injection (deterministic)",
      failure_reason: "chaos",
      transient: true,
      worker_id: WORKER_ID,
      correlation_id: traceId,
      metadata: { chaos: true, engine: "web", url: task.url },
    });
    await supabase.rpc("fail_web_scrape_task", {
      _id: task.id,
      _error: "chaos_injection",
      _transient: true,
      _failure_reason: "chaos",
    });
    return;
  }

  // 1) SSRF
  const safety = isSafeUrl(task.url);
  if (!safety.ok) {
    log2("warn", "ssrf_blocked", { reason: safety.reason });
    await supabase.rpc("fail_web_scrape_task", {
      _id: task.id,
      _error: `ssrf: ${safety.reason}`,
      _transient: false,
      _failure_reason: safety.reason,
    });
    return;
  }

  const host = hostnameOf(task.url)!;
  const service = `web:${host}`;

  // 2) Circuit breaker
  const cbOk = await checkCircuitBreaker(supabase, service);
  if (!cbOk) {
    log2("info", "circuit_open_defer");
    await supabase.rpc("defer_web_scrape_task", { _id: task.id, _delay_secs: 60, _reason: "circuit_open" });
    return;
  }

  try {
    // 3) robots.txt
    const origin = new URL(task.url).origin;
    const path = new URL(task.url).pathname + new URL(task.url).search;
    const policy = await getRobotsPolicy(supabase, host, origin);
    if (!isAllowed(policy, path)) {
      log2("info", "robots_blocked");
      await supabase.rpc("fail_web_scrape_task", {
        _id: task.id,
        _error: "robots.txt disallow",
        _transient: false,
        _failure_reason: "robots_blocked",
      });
      await reportSuccess(supabase, service); // não é falha do host
      return;
    }

    // 4) Fetch
    const res = await fetchWithTimeout(task.url, DEFAULT_TIMEOUT_MS, task.max_bytes);
    const status = res.status;
    const finalUrl = (res as Response & { _finalUrl?: string })._finalUrl ?? task.url;
    const contentType = res.headers.get("content-type") ?? "";

    if (!res.ok) {
      const transient = isTransientHttp(status);
      try { await res.body?.cancel(); } catch { /* noop */ }
      log2("warn", "http_error", { status, transient });
      if (transient) await reportFailure(supabase, service);
      await supabase.rpc("fail_web_scrape_task", {
        _id: task.id,
        _error: `HTTP ${status}`,
        _transient: transient,
        _failure_reason: `http_${status}`,
      });
      return;
    }

    // 5) Leitura + parsing
    const { text: html, bytes, partial } = await readCapped(res, task.max_bytes);
    const extracted = extractContent(html, finalUrl);

    if (isEmptyShell(html, extracted.textLength)) {
      log2("info", "spa_empty_shell", { html_len: html.length, text_len: extracted.textLength });
      await supabase.rpc("fail_web_scrape_task", {
        _id: task.id,
        _error: "SPA shell vazio (sem SSR)",
        _transient: false,
        _failure_reason: "spa_empty_shell",
      });
      await reportSuccess(supabase, service);
      return;
    }

    // 6) Grava resultado
    const { data: inserted, error: insErr } = await supabase
      .from("web_scrape_results")
      .insert({
        organization_id: task.organization_id,
        user_id: task.user_id,
        queue_task_id: task.id,
        trace_id: traceId,
        url: task.url,
        final_url: finalUrl,
        http_status: status,
        content_type: contentType,
        title: extracted.title,
        description: extracted.description,
        markdown: task.formats.includes("markdown") ? extracted.markdown : null,
        links: extracted.links,
        partial_content: partial,
        bytes,
        duration_ms: Date.now() - started,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      throw new Error(`insert_result_failed: ${insErr?.message ?? "no id"}`);
    }

    // 7) Completa
    await supabase.rpc("complete_web_scrape_task", { _id: task.id, _result_id: inserted.id });
    await reportSuccess(supabase, service);
    log2("info", "task_completed", { bytes, duration_ms: Date.now() - started, status });
  } catch (e) {
    const err = e as Error;
    const transient = /abort|timeout|network|fetch/i.test(err.message);
    log2("error", "task_error", { error: err.message, transient });
    if (transient) await reportFailure(supabase, service);
    await supabase.rpc("fail_web_scrape_task", {
      _id: task.id,
      _error: err.message.slice(0, 500),
      _transient: transient,
      _failure_reason: transient ? "network" : "unknown",
    });
  }
}

// ---------- loop ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Feature flag gating
  const { data: flags } = await supabase
    .from("feature_flags")
    .select("flag_key, is_enabled")
    .in("flag_key", ["web_scrape_enabled", "chaos_web_enabled"]);
  const flagMap = new Map((flags ?? []).map((f: { flag_key: string; is_enabled: boolean }) => [f.flag_key, !!f.is_enabled]));
  if (!flagMap.get("web_scrape_enabled")) {
    log("info", "worker_disabled_by_flag");
    return new Response(JSON.stringify({ processed: 0, disabled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const chaosEnabled = flagMap.get("chaos_web_enabled") ?? false;

  // Reserva um lote
  const { data: claimed, error } = await supabase.rpc("claim_web_scrape_tasks", {
    _limit: BATCH_SIZE,
    _worker: WORKER_ID,
  });

  if (error) {
    log("error", "claim_failed", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tasks = (claimed ?? []) as QueueTask[];
  log("info", "batch_claimed", { count: tasks.length });

  if (tasks.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Processa em chunks paralelos
  for (let i = 0; i < tasks.length; i += PARALLEL_CHUNK) {
    const chunk = tasks.slice(i, i + PARALLEL_CHUNK);
    await Promise.all(chunk.map((t) => processTask(supabase, t, chaosEnabled)));
  }

  return new Response(JSON.stringify({ processed: tasks.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
