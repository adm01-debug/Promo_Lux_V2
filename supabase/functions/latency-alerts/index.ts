// Alertas proativos de latência de API — cron a cada 15 min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isCronAuthorized } from "../_shared/cron-auth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Rodada #27: gate de service_role para cron-only.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!isCronAuthorized(req)) {
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
    const snapT = snap as Array<{ path: string | null; p95_ms: number | null }>;
    const pior = snapT.reduce((a, b) => (Number(b.p95_ms ?? 0) > Number(a.p95_ms ?? 0) ? b : a));
    const worst = Number(pior.p95_ms ?? 0);
    const limite = Number(s.p95_critical_ms ?? 1500);
    if (worst < limite) continue;

    const { data: last } = await supa
      .from("api_latency_alert_history")
      .select("created_at")
      .eq("organization_id", s.organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && new Date(last.created_at).getTime() > Date.now() - Number(s.cooldown_hours ?? 6) * 3_600_000) continue;

    const { data: admins } = await supa
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", s.organization_id)
      .eq("role", "admin");
    let notificados = 0;
    for (const a of admins ?? []) {
      const { error: erroNotif } = await supa.from("notifications").insert({
        user_id: a.user_id,
        organization_id: s.organization_id,
        type: "system",
        title: "Latência de API alta",
        message: `p95 observado ${worst}ms excedeu o limite de ${limite}ms.`,
        metadata: { organization_id: s.organization_id, path: pior.path, p95_ms: worst },
      });
      if (!erroNotif) notificados++;
    }

    await supa.from("api_latency_alert_history").insert({
      organization_id: s.organization_id,
      path: pior.path,
      p95_ms: worst,
      p95_critical_ms: limite,
      consecutive: 1,
      admins_notified: notificados,
    });

    triggered++;
  }

  return new Response(JSON.stringify({ ok: true, triggered }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
