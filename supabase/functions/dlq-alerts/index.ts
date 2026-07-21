// Alertas proativos de DLQ — cron a cada 15 min.
// Lê dlq_health_snapshots recentes por org, aplica settings, respeita cooldown,
// grava histórico e notifica admins da org via public.notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supa
    .from("dlq_alert_settings")
    .select("*")
    .eq("enabled", true);

  let triggered = 0;
  for (const s of settings ?? []) {
    const { data: snap } = await supa
      .from("dlq_health_snapshots")
      .select("*")
      .eq("organization_id", s.organization_id)
      .order("captured_at", { ascending: false })
      .limit(s.consecutive ?? 3);
    if (!snap || snap.length < (s.consecutive ?? 3)) continue;
    const allBreach = snap.every((r: any) => (r.pending_items ?? 0) >= (s.pending_critical ?? 100));
    if (!allBreach) continue;

    const { data: last } = await supa
      .from("dlq_alert_history")
      .select("triggered_at")
      .eq("organization_id", s.organization_id)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && new Date(last.triggered_at).getTime() > Date.now() - (s.cooldown_hours ?? 6) * 3600_000) continue;

    // Insere histórico
    await supa.from("dlq_alert_history").insert({
      organization_id: s.organization_id,
      pending_items: snap[0].pending_items,
      severity: "critical",
    });

    // Notifica admins da org
    const { data: admins } = await supa
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", s.organization_id)
      .eq("role", "admin");
    for (const a of admins ?? []) {
      await supa.from("notifications").insert({
        user_id: a.user_id,
        type: "system",
        title: "DLQ crítica",
        message: `A fila de dead-letter acumulou ${snap[0].pending_items} itens pendentes acima do limite (${s.pending_critical}).`,
        metadata: { organization_id: s.organization_id, pending_items: snap[0].pending_items },
      });
    }
    triggered++;
  }

  return new Response(JSON.stringify({ ok: true, triggered }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
