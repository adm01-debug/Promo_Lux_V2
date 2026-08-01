/**
 * Instagram Motor — E2E de ciclo completo: enqueue → resultados → DLQ replay
 *
 * Cobre o caminho de vida da fila do Instagram operando em HIKER_MOCK_MODE=true:
 *
 *   1. ENQUEUE
 *      - Insere uma tarefa "boa" (profile) que deve completar com sucesso.
 *      - Insere uma tarefa "envenenada" com _faults.actor_run_failed forçando
 *        falha permanente e max_attempts=1 → vai direto para a DLQ.
 *
 *   2. WORKER (HIKER_MOCK_MODE=true)
 *      - Invoca instagram-worker até drenar a fila.
 *      - Valida: profile → succeeded + resultados em instagram_scrape_results.
 *      - Valida: hashtag envenenada → status='dead' e linha em
 *        instagram_scrape_dead_letter.
 *
 *   3. DLQ REPLAY (manual, sem RPC dedicada)
 *      - Copia a tarefa da DLQ de volta para instagram_scrape_queue removendo
 *        o fault injetado (agora deve suceder).
 *      - Chama o worker de novo e valida sucesso + novos resultados.
 *
 *   4. UI Monitoring → aba Instagram
 *      - Autentica (login real quando E2E_TEST_EMAIL/PASSWORD estão presentes,
 *        senão demo mode) e valida que a aba Instagram do Monitoring
 *        renderiza o painel de conexão e permite testar credenciais.
 *
 * Auto-skippa quando faltam credenciais de backend, mantendo o suite verde em
 * PRs públicos.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginOrDemo } from "./helpers/auth";

const URL = process.env.VITE_SUPABASE_URL ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ORG = process.env.SMOKE_TEST_ORG_ID ?? "";

const hasBackend = Boolean(URL && SR && ORG);

async function invokeWorker(): Promise<{
  processed: number;
  results?: Array<{ queue_id: string; status: string; items?: number }>;
}> {
  const res = await fetch(`${URL}/functions/v1/instagram-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      "Content-Type": "application/json",
      "x-worker-id": `e2e-dlq-${Date.now()}`,
    },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  expect(res.ok, `worker HTTP ${res.status}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

async function drainQueue(maxAttempts = 5): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxAttempts; i++) {
    const r = await invokeWorker();
    total += r.processed ?? 0;
    if ((r.processed ?? 0) === 0) {
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
  return total;
}

test.describe("Instagram motor — enqueue → resultados → DLQ replay", () => {
  test.skip(
    !hasBackend,
    "requer VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SMOKE_TEST_ORG_ID",
  );

  test("ciclo completo: sucesso + DLQ + replay bem-sucedido", async () => {
    const supa = createClient(URL, SR, { auth: { persistSession: false } });
    const runTag = `dlq_${Date.now()}`;

    // 1) ENQUEUE ---------------------------------------------------------
    const goodHash = `e2e-dlq-good-${runTag}`;
    const poisonHash = `e2e-dlq-poison-${runTag}`;

    const { data: seeded, error: seedErr } = await supa
      .from("instagram_scrape_queue")
      .insert([
        {
          organization_id: ORG,
          target_type: "profile",
          target_value: `good_${runTag}`,
          params: { limit: 3 },
          config_hash: goodHash,
          max_attempts: 2,
          next_run_at: new Date().toISOString(),
          status: "queued",
        },
        {
          organization_id: ORG,
          target_type: "hashtag",
          target_value: `poison${runTag}`,
          // _faults é lido pelo apify-gateway/hiker-client mock para forçar erro permanente.
          params: { limit: 3, _faults: { actor_run_failed: true } },
          config_hash: poisonHash,
          max_attempts: 1,
          next_run_at: new Date().toISOString(),
          status: "queued",
        },
      ])
      .select("id, target_type, target_value, config_hash");

    expect(seedErr, seedErr?.message).toBeNull();
    expect(seeded).toHaveLength(2);

    const goodId = seeded!.find((r) => r.config_hash === goodHash)!.id;
    const poisonId = seeded!.find((r) => r.config_hash === poisonHash)!.id;

    // 2) WORKER drena --------------------------------------------------
    const processed = await drainQueue(4);
    expect(processed, "worker não processou nenhuma tarefa").toBeGreaterThanOrEqual(2);

    // 2a) tarefa boa → succeeded + resultados
    const { data: goodRow } = await supa
      .from("instagram_scrape_queue")
      .select("status, locked_at, last_error")
      .eq("id", goodId)
      .single();
    expect(goodRow?.status, `good task falhou: ${goodRow?.last_error ?? "(sem erro)"}`).toBe(
      "succeeded",
    );
    expect(goodRow?.locked_at).toBeNull();

    const { data: goodResults } = await supa
      .from("instagram_scrape_results")
      .select("id, item_type")
      .eq("queue_id", goodId);
    expect(goodResults?.length ?? 0, "sem resultados para tarefa boa").toBeGreaterThan(0);

    // 2b) tarefa envenenada → dead + linha na DLQ
    const { data: poisonRow } = await supa
      .from("instagram_scrape_queue")
      .select("status, last_error")
      .eq("id", poisonId)
      .single();
    expect(
      poisonRow?.status,
      `esperava status=dead na tarefa envenenada (last_error=${poisonRow?.last_error ?? "n/a"})`,
    ).toBe("dead");

    const { data: dlqRows } = await supa
      .from("instagram_scrape_dead_letter")
      .select("id, queue_id, target_type, target_value, params, attempts, last_error")
      .eq("queue_id", poisonId);
    expect(dlqRows?.length ?? 0, "tarefa envenenada não chegou à DLQ").toBeGreaterThan(0);
    const dlq = dlqRows![0];
    expect(dlq.attempts).toBeGreaterThanOrEqual(1);
    expect(dlq.last_error, "DLQ sem last_error").toBeTruthy();

    // 3) DLQ REPLAY ---------------------------------------------------
    // Reenfileira sem a injeção de falha — deve completar com sucesso.
    const replayHash = `e2e-dlq-replay-${runTag}`;
    const { data: replayed, error: replayErr } = await supa
      .from("instagram_scrape_queue")
      .insert({
        organization_id: ORG,
        target_type: dlq.target_type,
        target_value: dlq.target_value,
        // limpa _faults; mantém demais parâmetros
        params: { ...((dlq.params as Record<string, unknown>) ?? {}), _faults: undefined, limit: 3 },
        config_hash: replayHash,
        max_attempts: 2,
        next_run_at: new Date().toISOString(),
        status: "queued",
      })
      .select("id")
      .single();
    expect(replayErr, replayErr?.message).toBeNull();
    const replayId = replayed!.id;

    await drainQueue(4);

    const { data: replayRow } = await supa
      .from("instagram_scrape_queue")
      .select("status, last_error")
      .eq("id", replayId)
      .single();
    expect(
      replayRow?.status,
      `replay não completou: ${replayRow?.last_error ?? "(sem erro)"}`,
    ).toBe("succeeded");

    const { data: replayResults } = await supa
      .from("instagram_scrape_results")
      .select("id")
      .eq("queue_id", replayId);
    expect(replayResults?.length ?? 0, "replay sem resultados").toBeGreaterThan(0);

    // Cleanup best-effort (não falha o teste se RLS bloquear delete)
    await supa
      .from("instagram_scrape_queue")
      .delete()
      .in("id", [goodId, poisonId, replayId]);
    await supa.from("instagram_scrape_dead_letter").delete().eq("queue_id", poisonId);
  });
});

test.describe("Monitoring → aba Instagram (UI)", () => {
  test("renderiza painel de conexão e expõe ação de testar credenciais", async ({ page }: { page: Page }) => {
    await loginOrDemo(page);

    // Navega até Monitoring (rota conhecida do app).
    await page.goto("/monitoring");

    // Ativa a aba Instagram (tab é um <button role="tab"> gerado pelo shadcn Tabs).
    const instagramTab = page.getByRole("tab", { name: /instagram/i });
    await expect(instagramTab).toBeVisible({ timeout: 10_000 });
    await instagramTab.click();

    // Painel presente
    await expect(
      page.getByRole("heading", { name: /Conex[ãa]o do Motor de Instagram/i }),
    ).toBeVisible();

    // Provedores esperados listados
    await expect(page.getByText(/HikerAPI/i).first()).toBeVisible();
    await expect(page.getByText(/Bright Data/i).first()).toBeVisible();
    await expect(page.getByText(/Apify/i).first()).toBeVisible();

    // Botão de ação principal existe e é acionável
    const testBtn = page.getByRole("button", { name: /Testar credenciais/i });
    await expect(testBtn).toBeVisible();
    await expect(testBtn).toBeEnabled();
  });
});
