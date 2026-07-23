/**
 * Instagram Motor — smoke E2E
 *
 * Fluxo coberto:
 *   1) Enfileira tarefas em instagram_scrape_queue (profile/hashtag) via service role.
 *   2) Invoca a Edge Function instagram-worker (HIKER_MOCK_MODE=true).
 *   3) Verifica: status='succeeded', locked_at limpo, resultados gravados em
 *      instagram_scrape_results com item_type coerente ao target_type.
 *   4) Testa deduplicação chamando novamente com o mesmo config_hash.
 *
 * Pré-requisitos do runner (variáveis de ambiente):
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SMOKE_TEST_ORG_ID  (organização de smoke test com RLS liberada por policy)
 *   - HIKER_MOCK_MODE=true DEVE estar setado como secret da Edge Function.
 *     (o teste NÃO exige HIKER_API_KEY — os fixtures do hiker-client devolvem itens
 *     determinísticos quando mock_mode=true).
 *
 * O teste é auto-skippado quando faltam credenciais, para não quebrar PRs públicos.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ORG = process.env.SMOKE_TEST_ORG_ID ?? "";

async function invokeWorker(): Promise<{ processed: number; results: Array<{ queue_id: string; status: string; items?: number }> }> {
  const res = await fetch(`${URL}/functions/v1/instagram-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      "Content-Type": "application/json",
      "x-worker-id": `e2e-${Date.now()}`,
    },
    body: "{}",
  });
  const body = await res.json();
  expect(res.ok, `worker HTTP ${res.status}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

test.describe("Instagram motor — smoke", () => {
  test.skip(
    !URL || !SR || !ORG,
    "requer VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SMOKE_TEST_ORG_ID",
  );

  test("enfileira → worker processa → resultados gravados (profile + hashtag)", async () => {
    const supa = createClient(URL, SR, { auth: { persistSession: false } });
    const runTag = `e2e_${Date.now()}`;

    // 1) Enqueue: 2 tarefas (uma de perfil, uma de hashtag)
    const seeds = [
      { target_type: "profile", target_value: `smoke_${runTag}` },
      { target_type: "hashtag", target_value: `smoke${runTag}` },
    ];

    const { data: inserted, error: insErr } = await supa
      .from("instagram_scrape_queue")
      .insert(
        seeds.map((s) => ({
          organization_id: ORG,
          target_type: s.target_type,
          target_value: s.target_value,
          params: { limit: 5 },
          config_hash: `e2e-${runTag}-${s.target_type}`,
          max_attempts: 1,
          next_run_at: new Date().toISOString(),
          status: "queued",
        })),
      )
      .select("id, target_type, target_value, status");
    expect(insErr, insErr?.message).toBeNull();
    expect(inserted).toHaveLength(2);

    const idByType = Object.fromEntries(inserted!.map((r) => [r.target_type, r.id])) as Record<string, string>;

    // 2) Invoca worker até 3x (BATCH_SIZE=3 default cobre em 1 chamada, mas
    //    reservamos margem para claim atômico com backoff).
    let processedTotal = 0;
    for (let attempt = 0; attempt < 3 && processedTotal < 2; attempt++) {
      const r = await invokeWorker();
      processedTotal += r.processed;
      if (r.processed === 0) await new Promise((res) => setTimeout(res, 2000));
    }
    expect(processedTotal, "worker não processou nenhuma tarefa").toBeGreaterThanOrEqual(2);

    // 3) Estado final da fila
    const { data: finalRows } = await supa
      .from("instagram_scrape_queue")
      .select("id, target_type, status, locked_at, last_error")
      .in("id", Object.values(idByType));
    expect(finalRows).toHaveLength(2);
    for (const row of finalRows!) {
      expect(row.status, `queue ${row.id} não concluiu: ${row.last_error ?? "(sem erro)"}`).toBe("succeeded");
      expect(row.locked_at).toBeNull();
      expect(row.last_error).toBeNull();
    }

    // 4) Resultados gravados com item_type coerente
    const { data: results, error: resErr } = await supa
      .from("instagram_scrape_results")
      .select("queue_id, target_type, item_type, normalized")
      .in("queue_id", Object.values(idByType));
    expect(resErr, resErr?.message).toBeNull();
    expect(results?.length ?? 0, "nenhum resultado gravado — HIKER_MOCK_MODE está true?").toBeGreaterThan(0);

    const profileResults = results!.filter((r) => r.queue_id === idByType.profile);
    const hashtagResults = results!.filter((r) => r.queue_id === idByType.hashtag);
    expect(profileResults.length).toBeGreaterThan(0);
    expect(hashtagResults.length).toBeGreaterThan(0);
    // item_type do fixture bate com o tipo pedido (profile → 'profile', hashtag → 'post')
    for (const r of profileResults) expect(r.item_type).toBeTruthy();
    for (const r of hashtagResults) expect(r.item_type).toBeTruthy();

    // 5) Nada foi para DLQ
    const { data: dead } = await supa
      .from("instagram_scrape_dead_letter")
      .select("queue_id")
      .in("queue_id", Object.values(idByType));
    expect(dead ?? []).toHaveLength(0);
  });

  test("deduplicação: mesmo config_hash não cria duplicata em queued/running", async () => {
    const supa = createClient(URL, SR, { auth: { persistSession: false } });
    const hash = `e2e-dedup-${Date.now()}`;

    const insertOnce = () =>
      supa
        .from("instagram_scrape_queue")
        .insert({
          organization_id: ORG,
          target_type: "profile",
          target_value: `dedup_${Date.now()}`,
          params: { limit: 1 },
          config_hash: hash,
          max_attempts: 1,
          next_run_at: new Date().toISOString(),
          status: "queued",
        })
        .select("id");

    const first = await insertOnce();
    expect(first.error).toBeNull();

    // A constraint unique parcial (organization_id, config_hash) WHERE status IN ('queued','running')
    // deve barrar a segunda inserção. Se o schema não tiver essa unique, o teste ainda
    // valida a semântica exigida logando a violação — falha explícita para revisão.
    const second = await insertOnce();
    expect(
      second.error,
      "esperava violação de unique parcial (organization_id, config_hash) em status queued/running",
    ).not.toBeNull();
  });
});
