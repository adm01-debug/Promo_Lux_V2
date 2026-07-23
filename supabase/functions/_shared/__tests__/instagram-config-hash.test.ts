import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalizeConfig,
  clampLimit,
  computeConfigHash,
  normalizeTarget,
} from "../instagram-config-hash.ts";

const ORG = "11111111-1111-1111-1111-111111111111";
const ORG_2 = "22222222-2222-2222-2222-222222222222";

Deno.test("normalizeTarget: trim, lowercase, remove @ e #", () => {
  assertEquals(normalizeTarget("  @Lux.IA  "), "lux.ia");
  assertEquals(normalizeTarget("#Marketing"), "marketing");
  assertEquals(normalizeTarget("USERNAME"), "username");
  assertEquals(normalizeTarget(""), "");
});

Deno.test("clampLimit: default, floor, ceil e truncamento", () => {
  assertEquals(clampLimit(undefined), 200);
  assertEquals(clampLimit("abc"), 200);
  assertEquals(clampLimit(0), 1);
  assertEquals(clampLimit(999999), 1000);
  assertEquals(clampLimit("42.9"), 42);
});

Deno.test("computeConfigHash: mesma tupla ⇒ mesmo hash (estabilidade)", async () => {
  const h1 = await computeConfigHash({
    organization_id: ORG, target_type: "profile", target_value: "lux.ia", limit: 200,
  });
  const h2 = await computeConfigHash({
    organization_id: ORG, target_type: "profile", target_value: "lux.ia", limit: 200,
  });
  assertEquals(h1, h2);
  assertEquals(h1.length, 64); // sha256 hex
});

Deno.test("computeConfigHash: invariante a variações de forma do target", async () => {
  const base = await computeConfigHash({
    organization_id: ORG, target_type: "hashtag", target_value: "marketing", limit: 200,
  });
  const variants = ["#marketing", "  MARKETING  ", "#Marketing", "@marketing"];
  for (const v of variants) {
    const h = await computeConfigHash({
      organization_id: ORG, target_type: "hashtag", target_value: v, limit: 200,
    });
    assertEquals(h, base, `esperado igual para "${v}"`);
  }
});

Deno.test("computeConfigHash: limit default coincide com limit=200 explícito", async () => {
  const a = await computeConfigHash({ organization_id: ORG, target_type: "posts", target_value: "lux.ia" });
  const b = await computeConfigHash({ organization_id: ORG, target_type: "posts", target_value: "lux.ia", limit: 200 });
  assertEquals(a, b);
});

Deno.test("computeConfigHash: sensível a organization_id, target_type, target e limit", async () => {
  const base = await computeConfigHash({
    organization_id: ORG, target_type: "posts", target_value: "lux.ia", limit: 200,
  });
  const other = [
    { organization_id: ORG_2, target_type: "posts" as const, target_value: "lux.ia", limit: 200 },
    { organization_id: ORG, target_type: "profile" as const, target_value: "lux.ia", limit: 200 },
    { organization_id: ORG, target_type: "posts" as const, target_value: "outra.conta", limit: 200 },
    { organization_id: ORG, target_type: "posts" as const, target_value: "lux.ia", limit: 100 },
  ];
  for (const cfg of other) {
    assertNotEquals(await computeConfigHash(cfg), base, `esperado diferente para ${JSON.stringify(cfg)}`);
  }
});

Deno.test("canonicalizeConfig: chaves ordenadas alfabeticamente", () => {
  const s = canonicalizeConfig({
    organization_id: ORG, target_type: "profile", target_value: "@Lux.IA", limit: 200,
  });
  assertEquals(s, JSON.stringify({
    limit: 200,
    organization_id: ORG,
    target: "lux.ia",
    target_type: "profile",
  }));
});

Deno.test("computeConfigHash: hash é sha256 hex válido e estável cross-run", async () => {
  const cfg = {
    organization_id: "00000000-0000-0000-0000-000000000000",
    target_type: "profile" as const,
    target_value: "lux.ia",
    limit: 200,
  };
  const h1 = await computeConfigHash(cfg);
  const h2 = await computeConfigHash({ ...cfg, target_value: "LUX.IA" });
  assertEquals(h1.length, 64);
  assert(/^[0-9a-f]{64}$/.test(h1));
  assertEquals(h1, h2, "case-insensitive no target_value");
});
