// Alertas proativos de DLQ — cron a cada 15 min.
// Rodada #17: processa duas filas em uma execução:
//   - 'scrape' (dead letter da fila legada) — snapshots já capturados por cron.
//   - 'web'    (dead letter do motor web nativo) — snapshots capturados aqui via
//     RPC `capture_web_dlq_health_snapshots` antes da avaliação.
// Cada `queue_kind` tem settings/history independentes na chave
// (organization_id, queue_kind) e cooldown próprio.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type QueueKind = "scrape" | "web";

interface Setting {
  organization_id: string;
  queue_kind: QueueKind;
  pending_critical: number;
  consecutive: number;
  cooldown_hours: number;
  enabled: boolean;
}

async function processKind(supa: SupabaseClient, kind: QueueKind): Promise<number> {
  const { data: settings } = await supa
    .from("dlq_alert_settings")
    .select("*")
    .eq("enabled", true)
    .eq("queue_kind", kind);

  let triggered = 0;
  for (const s of (settings ?? []) as Setting[]) {
    const consecutive = s.consecutive ?? 3;
    const { data: snap } = await supa
      .from("dlq_health_snapshots")
      .select("pending_items,captured_at")
      .eq("organization_id", s.organization_id)
      .eq("queue_kind", kind)
      .order("captured_at", { ascending: false })
      .limit(consecutive);
    if (!snap || snap.length < consecutive) continue;

    const critical = s.pending_critical ?? 100;
    const allBreach = snap.every((r: { pending_items: number | null }) => (r.pending_items ?? 0) >= critical);
    if (!allBreach) continue;

    const { data: last } = await supa
      .from("dlq_alert_history")
      .select("triggered_at")
      .eq("organization_id", s.organization_id)
      .eq("queue_kind", kind)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cooldownMs = (s.cooldown_hours ?? 6) * 3600_000;
    if (last && new Date((last as { triggered_at: string }).triggered_at).getTime() > Date.now() - cooldownMs) continue;

    const topPending = (snap[0] as { pending_items: number }).pending_items;

    await supa.from("dlq_alert_history").insert({
      organization_id: s.organization_id,
      queue_kind: kind,
      pending_items: topPending,
      pending_critical: critical,
      consecutive,
    });

    const { data: admins } = await supa
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", s.organization_id)
      .eq("role", "admin");

    const kindLabel = kind === "web" ? "DLQ web crítica" : "DLQ crítica";
    for (const a of (admins ?? []) as { user_id: string }[]) {
      await supa.from("notifications").insert({
        user_id: a.user_id,
        type: "system",
        title: kindLabel,
        message: `A fila de dead-letter (${kind}) acumulou ${topPending} itens pendentes acima do limite (${critical}).`,
        metadata: { organization_id: s.organization_id, queue_kind: kind, pending_items: topPending },
      });
    }
    triggered++;
  }
  return triggered;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Garante snapshot fresco da DLQ web antes de avaliar.
  try {
    await supa.rpc("capture_web_dlq_health_snapshots");
  } catch (_e) { /* snapshot best-effort */ }

  const scrapeTriggered = await processKind(supa, "scrape");
  const webTriggered = await processKind(supa, "web");

  return new Response(
    JSON.stringify({ ok: true, triggered: scrapeTriggered + webTriggered, by_kind: { scrape: scrapeTriggered, web: webTriggered } }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
