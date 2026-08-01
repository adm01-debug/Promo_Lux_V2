// Alertas proativos de latência de API — cron a cada 15 min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Rodada #27: gate de service_role para cron-only.
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);


  const { data: settings } = await supa
    .from("api_latency_alert_settings")
    .select("*")
    .eq("enabled", true);

  let triggered = 0;
  for (const s of settings ?? []) {
    const { data: snap } = await supa
      .from("api_latency_snapshots")
      .select("*")
      .eq("organization_id", s.organization_id)
      .gte("captured_at", new Date(Date.now() - 30 * 60_000).toISOString())
      .order("captured_at", { ascending: false })
      .limit(10);
    if (!snap?.length) continue;
    const worst = Math.max(...snap.map((r: any) => Number(r.p95_ms ?? 0)));
    if (worst < (s.p95_threshold_ms ?? 5000)) continue;

    const { data: last } = await supa
      .from("api_latency_alert_history")
      .select("triggered_at")
      .eq("organization_id", s.organization_id)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && new Date(last.triggered_at).getTime() > Date.now() - (s.cooldown_minutes ?? 60) * 60_000) continue;

    await supa.from("api_latency_alert_history").insert({
      organization_id: s.organization_id,
      p95_ms: worst,
      threshold_ms: s.p95_threshold_ms,
      severity: worst > (s.p95_threshold_ms ?? 5000) * 2 ? "critical" : "warning",
    });

    const { data: admins } = await supa
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", s.organization_id)
      .eq("role", "admin");
    for (const a of admins ?? []) {
      await supa.from("notifications").insert({
        user_id: a.user_id,
        type: "system",
        title: "Latência de API alta",
        message: `p95 observado ${worst}ms excedeu o limite de ${s.p95_threshold_ms}ms.`,
        metadata: { organization_id: s.organization_id, p95_ms: worst },
      });
    }
    triggered++;
  }

  return new Response(JSON.stringify({ ok: true, triggered }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
