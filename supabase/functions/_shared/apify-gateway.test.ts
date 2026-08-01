/**
 * Testes de injeção de falhas do apify-gateway mock.
 * Cobre: rate_limit_429, timeout, actor_run_failed, empty_dataset.
 */
import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  _resetFaultRegistry,
  type ApifyClientOptions,
  type FaultSpec,
  getDatasetItems,
  getRunStatus,
  startActorRun,
} from "./apify-gateway.ts";

const MOCK_OPTS: ApifyClientOptions = {
  lovableApiKey: "x",
  connectionApiKey: "x",
  mockMode: true,
};

const ACTOR = "apify/instagram-profile-scraper";

function withFault(kind: FaultSpec["kind"], extra: Partial<FaultSpec> = {}) {
  return { _faults: { kind, probability: 1, ...extra } } as Record<string, unknown>;
}

Deno.test("fault: rate_limit_429 em startActorRun", async () => {
  _resetFaultRegistry();
  await assertRejects(
    () => startActorRun(ACTOR, withFault("rate_limit_429"), MOCK_OPTS),
    Error,
    "429",
  );
});

Deno.test("fault: timeout em startActorRun respeita timeoutMs", async () => {
  _resetFaultRegistry();
  const t0 = Date.now();
  await assertRejects(
    () => startActorRun(ACTOR, withFault("timeout", { timeoutMs: 30 }), MOCK_OPTS),
    Error,
    "timeout",
  );
  const dt = Date.now() - t0;
  if (dt < 25) throw new Error(`timeout retornou cedo demais: ${dt}ms`);
});

Deno.test("fault: actor_run_failed marca run como FAILED e propaga no poll", async () => {
  _resetFaultRegistry();
  const run = await startActorRun(ACTOR, withFault("actor_run_failed"), MOCK_OPTS);
  assertEquals(run.status, "FAILED");
  const polled = await getRunStatus(run.id, MOCK_OPTS);
  assertEquals(polled.status, "FAILED");
});

Deno.test("fault: empty_dataset devolve [] em getDatasetItems", async () => {
  _resetFaultRegistry();
  const run = await startActorRun(ACTOR, withFault("empty_dataset"), MOCK_OPTS);
  assertEquals(run.status, "SUCCEEDED");
  const items = await getDatasetItems(run.defaultDatasetId, ACTOR, 10, MOCK_OPTS);
  assertEquals(items.length, 0);
});

Deno.test("sem fault: fixtures normais são servidos", async () => {
  _resetFaultRegistry();
  const run = await startActorRun(ACTOR, {}, MOCK_OPTS);
  const items = await getDatasetItems(run.defaultDatasetId, ACTOR, 5, MOCK_OPTS);
  if (items.length === 0) throw new Error("esperava fixtures não vazios");
});

Deno.test("env APIFY_MOCK_FAULTS aplica catch-all por actor", async () => {
  _resetFaultRegistry();
  Deno.env.set(
    "APIFY_MOCK_FAULTS",
    JSON.stringify({ [ACTOR]: { kind: "empty_dataset", probability: 1 } }),
  );
  try {
    const run = await startActorRun(ACTOR, {}, MOCK_OPTS);
    const items = await getDatasetItems(run.defaultDatasetId, ACTOR, 10, MOCK_OPTS);
    assertEquals(items.length, 0);
  } finally {
    Deno.env.delete("APIFY_MOCK_FAULTS");
  }
});

Deno.test("env APIFY_MOCK_FAULTS wildcard '*' bate em qualquer actor", async () => {
  _resetFaultRegistry();
  Deno.env.set(
    "APIFY_MOCK_FAULTS",
    JSON.stringify({ "*": { kind: "rate_limit_429", probability: 1 } }),
  );
  try {
    await assertRejects(
      () => startActorRun("apify/instagram-hashtag-scraper", {}, MOCK_OPTS),
      Error,
      "429",
    );
  } finally {
    Deno.env.delete("APIFY_MOCK_FAULTS");
  }
});
