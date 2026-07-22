// pg-net-watchdog — Rodada #25
// - Advisory lock impede execuções concorrentes (idempotência sob overlap de cron).
// - Dedup por cooldown (60 min) evita tempestade de notificações.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ERROR_RATE_THRESHOLD = 5.0;
const BACKLOG_THRESHOLD = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Rodada #27: gate de service_role — evita invocação por anon.
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Advisory lock — tenta reservar execução única
  const { data: lockData } = await supa.rpc("pg_net_watchdog_try_lock");
  if (lockData === false) {
    return new Response(JSON.stringify({ ok: true, skipped: "another_run_in_progress" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supa.rpc("pg_net_health", { _window_hours: 24 });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const total = Number(row?.total_requests ?? 0);
  const errors = Number(row?.error_count ?? 0);
  const errorRate = Number(row?.error_rate_pct ?? 0);
  const p95 = row?.p95_latency_ms == null ? null : Number(row.p95_latency_ms);
  const backlog = Number(row?.backlog_pending ?? 0);

  await supa.from("pg_net_health_snapshots").insert({
    window_hours: 24,
    total_requests: total,
    error_count: errors,
    error_rate_pct: errorRate,
    p95_latency_ms: p95,
    backlog_pending: backlog,
  });

  const breach = errorRate > ERROR_RATE_THRESHOLD || backlog > BACKLOG_THRESHOLD;
  let notified = 0;
  let suppressed = 0;

  if (breach) {
    const { data: admins } = await supa
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    for (const a of (admins ?? []) as { user_id: string }[]) {
      const { data: shouldNotify } = await supa.rpc("pg_net_watchdog_should_notify", {
        _admin_id: a.user_id,
        _cooldown_minutes: 60,
      });
      if (shouldNotify === false) {
        suppressed++;
        continue;
      }
      await supa.from("notifications").insert({
        user_id: a.user_id,
        type: "system",
        title: "pg_net degradado",
        message: `Taxa de erro ${errorRate}% e backlog ${backlog} em 24h — verifique cron jobs.`,
        metadata: { total, errors, error_rate_pct: errorRate, backlog_pending: backlog, p95_latency_ms: p95 },
      });
      notified++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, metrics: { total, errors, errorRate, backlog, p95 }, breach, notified, suppressed }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
