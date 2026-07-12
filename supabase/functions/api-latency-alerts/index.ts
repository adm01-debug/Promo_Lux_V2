/**
 * API Latency Alerts
 * ============================================================
 * Executado periodicamente (cron via pg_cron + pg_net, sugerido a cada
 * 15 min) ou manualmente por um admin. Em cada execução:
 *   1. Captura um snapshot de latência (p50/p95/p99, volume e taxa de erro)
 *      por rota/organização a partir de `api_request_logs` da última hora.
 *   2. Avalia se alguma rota cruzou o limite crítico de p95 por N ciclos
 *      consecutivos (respeitando o cooldown por rota) e notifica os
 *      administradores da organização.
 *
 * Não retorna dados sensíveis: apenas contadores agregados. Toda a lógica
 * de isolamento e autorização vive nas RPCs SECURITY DEFINER chamadas com
 * a service role key.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LogFields {
  [k: string]: unknown;
}

function log(level: "info" | "warn" | "error", msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    function: "api-latency-alerts",
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    log("error", "missing env", { request_id: requestId });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Captura o snapshot da última hora.
    const { data: captured, error: capErr } = await admin.rpc(
      "capture_api_latency_snapshots",
      { _hours: 1 },
    );
    if (capErr) {
      log("error", "capture_failed", { request_id: requestId, error: capErr.message });
      return new Response(JSON.stringify({ error: capErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Avalia os alertas de latência.
    const { data: alerts, error: evalErr } = await admin.rpc(
      "evaluate_api_latency_alerts",
    );
    if (evalErr) {
      log("error", "evaluate_failed", { request_id: requestId, error: evalErr.message });
      return new Response(JSON.stringify({ error: evalErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("info", "done", {
      request_id: requestId,
      snapshots_captured: captured ?? 0,
      admins_notified: alerts ?? 0,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        snapshots_captured: captured ?? 0,
        admins_notified: alerts ?? 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "unhandled", { request_id: requestId, error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
