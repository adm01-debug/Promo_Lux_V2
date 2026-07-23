// SLA Alerts — cron horário.
// Consulta `sla_compliance_stats(window_hours)` e, para cada fila
// (scrape/web/instagram) cuja taxa de estouro de SLA >= breach_pct e cujo
// tamanho de amostra atinja min_sample, dispara alerta respeitando cooldown
// por fila. Notificação vai para todos os admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Settings = {
  enabled: boolean;
  window_hours: number;
  breach_pct: number;
  min_sample: number;
  cooldown_hours: number;
};

type StatsRow = {
  queue_kind: "scrape" | "web" | "instagram";
  sample_size: number;
  with_sla: number;
  breaches: number;
  breach_rate: number;
  p95_seconds: number | null;
  sla_p95: number | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const authorized =
    (serviceKey && (bearer === serviceKey || apiKeyHeader === serviceKey)) ||
    (anonKey && (bearer === anonKey || apiKeyHeader === anonKey));
  if (!authorized) return json(401, { ok: false, error: "unauthorized" });

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data: settingsRow } = await supa
      .from("sla_alert_settings")
      .select("enabled, window_hours, breach_pct, min_sample, cooldown_hours")
      .maybeSingle();

    const s = (settingsRow ?? {
      enabled: true,
      window_hours: 24,
      breach_pct: 20,
      min_sample: 20,
      cooldown_hours: 6,
    }) as Settings;

    if (!s.enabled) return json(200, { ok: true, triggered: 0, skipped: "disabled" });

    const { data: statsRaw, error: statsErr } = await supa.rpc("sla_compliance_stats", {
      p_hours: s.window_hours,
    });
    if (statsErr) throw new Error(`stats_rpc: ${statsErr.message}`);

    const stats = (statsRaw ?? []) as StatsRow[];
    const now = Date.now();
    const cooldownMs = s.cooldown_hours * 3600_000;
    const threshold = s.breach_pct / 100;

    const triggered: string[] = [];

    for (const row of stats) {
      if (row.sample_size < s.min_sample) continue;
      if ((row.breach_rate ?? 0) < threshold) continue;

      // cooldown por fila
      const { data: last } = await supa
        .from("sla_alert_history")
        .select("triggered_at")
        .eq("queue_kind", row.queue_kind)
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        last &&
        new Date((last as { triggered_at: string }).triggered_at).getTime() > now - cooldownMs
      ) {
        continue;
      }

      await supa.from("sla_alert_history").insert({
        queue_kind: row.queue_kind,
        breach_rate: row.breach_rate,
        sample_size: row.sample_size,
        window_hours: s.window_hours,
        p95_seconds: row.p95_seconds,
        sla_p95: row.sla_p95,
        details: {
          with_sla: row.with_sla,
          breaches: row.breaches,
          threshold_pct: s.breach_pct,
        },
      });

      const { data: admins } = await supa
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const uniqueUsers = Array.from(
        new Set((admins ?? []).map((a: { user_id: string }) => a.user_id)),
      );

      const pct = ((row.breach_rate ?? 0) * 100).toFixed(1);
      const title = `SLA em risco — fila ${row.queue_kind}`;
      const message =
        `Nas últimas ${s.window_hours}h, ${pct}% das tarefas da fila ${row.queue_kind} ` +
        `ultrapassaram o SLA (${row.breaches}/${row.with_sla} com SLA, amostra=${row.sample_size}). ` +
        `p95 real=${row.p95_seconds ?? "—"}s / SLA p95=${row.sla_p95 ?? "—"}s.`;

      for (const user_id of uniqueUsers) {
        await supa.from("notifications").insert({
          user_id,
          type: "system",
          title,
          message,
          metadata: {
            source: "sla-alerts",
            queue_kind: row.queue_kind,
            breach_rate: row.breach_rate,
            sample_size: row.sample_size,
            window_hours: s.window_hours,
            p95_seconds: row.p95_seconds,
            sla_p95: row.sla_p95,
          },
        });
      }
      triggered.push(row.queue_kind);
    }

    return json(200, { ok: true, triggered: triggered.length, queues: triggered });
  } catch (e) {
    return json(500, { ok: false, error: (e as Error).message ?? "internal_error" });
  }
});
