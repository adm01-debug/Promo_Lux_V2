/**
 * Rodada #24 — Smoke test do ciclo DLQ web
 * Injeta URL sabidamente inválida na web_scrape_queue, aguarda cair na DLQ,
 * confirma snapshot e valida replay_web_dead_letter_batch.
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY no ambiente do runner (não é rodado em PR
 * público — ver playwright.config.ts para gate opcional).
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? "";
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ORG = process.env.SMOKE_TEST_ORG_ID ?? "";

test.describe("DLQ web — smoke", () => {
  test.skip(!URL || !SR || !ORG, "requer VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SMOKE_TEST_ORG_ID");

  test("ciclo enqueue → DLQ → snapshot → replay", async () => {
    const supa = createClient(URL, SR, { auth: { persistSession: false } });
    const badUrl = `https://this-domain-does-not-exist-${Date.now()}.invalid/`;

    // 1) Enqueue
    const { data: enq, error: enqErr } = await supa
      .from("web_scrape_queue")
      .insert({
        organization_id: ORG,
        url: badUrl,
        formats: ["markdown"],
        max_attempts: 1, // força cair na DLQ na 1ª falha
        next_run_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(enqErr).toBeNull();
    const taskId = enq!.id as string;

    // 2) Aguarda até 90s pela DLQ (worker roda em cron; tolerância generosa)
    let dlqRow: { id: string } | null = null;
    for (let i = 0; i < 30; i++) {
      const { data } = await supa
        .from("web_scrape_dead_letter")
        .select("id, original_task_id")
        .eq("original_task_id", taskId)
        .maybeSingle();
      if (data) { dlqRow = data as { id: string }; break; }
      await new Promise((r) => setTimeout(r, 3000));
    }
    expect(dlqRow, "tarefa não chegou à DLQ web em 90s").not.toBeNull();

    // 3) Snapshot fresco
    await supa.rpc("capture_web_dlq_health_snapshots");
    const { data: snap } = await supa
      .from("dlq_health_snapshots")
      .select("pending_items")
      .eq("organization_id", ORG)
      .eq("queue_kind", "web")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(snap, "snapshot da DLQ web não capturado").not.toBeNull();

    // 4) Replay — reenfileira e marca replayed_at
    const { data: replayed } = await supa.rpc("replay_web_dead_letter_batch", {
      _organization_id: ORG,
      _limit: 10,
    });
    expect(Number(replayed ?? 0)).toBeGreaterThanOrEqual(1);

    const { data: dlqAfter } = await supa
      .from("web_scrape_dead_letter")
      .select("replayed_at")
      .eq("id", dlqRow!.id)
      .single();
    expect(dlqAfter?.replayed_at).not.toBeNull();
  });
});
