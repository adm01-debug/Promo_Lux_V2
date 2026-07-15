/**
 * Circuit Breaker Alerts
 * ============================================================
 * Executada periodicamente (cron a cada 5 min) ou manualmente por um admin.
 * A cada ciclo:
 *   1. Captura um snapshot do estado atual de todos os disjuntores em
 *      `public.circuit_breakers` (para métricas históricas).
 *   2. Avalia `circuit_breaker_alert_settings` e notifica admins quando um
 *      disjuntor abre, entra em meio-aberto, ou ultrapassa o limiar de
 *      falhas consecutivas — respeitando cooldown por serviço.
 *
 * Toda a lógica de autorização vive nas RPCs SECURITY DEFINER; esta função
 * apenas orquestra e retorna contadores agregados (sem PII).
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
    function: "circuit-breaker-alerts",
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
    log("error", "missing_env", { request_id: requestId });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: captured, error: capErr } = await admin.rpc(
      "capture_circuit_breaker_snapshots",
    );
    if (capErr) {
      log("error", "capture_failed", { request_id: requestId, error: capErr.message });
      return new Response(JSON.stringify({ error: capErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: alerts, error: evalErr } = await admin.rpc(
      "evaluate_circuit_breaker_alerts",
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
      alerts_triggered: alerts ?? 0,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        snapshots_captured: captured ?? 0,
        alerts_triggered: alerts ?? 0,
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
