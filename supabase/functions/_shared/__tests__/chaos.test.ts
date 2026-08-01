import { describe, it, expect } from "vitest";
import { shouldInjectChaos } from "../web-scrape/chaos.ts";

describe("shouldInjectChaos", () => {
  it("é determinístico para o mesmo task_id", () => {
    const id = "abc-123";
    expect(shouldInjectChaos(id, 0.5)).toBe(shouldInjectChaos(id, 0.5));
  });

  it("respeita rate=0 (nunca injeta)", () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldInjectChaos(`t-${i}`, 0)).toBe(false);
    }
  });

  it("respeita rate=1 (sempre injeta)", () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldInjectChaos(`t-${i}`, 1)).toBe(true);
    }
  });

  it("distribui aproximadamente próximo do rate esperado em N=5000", () => {
    let hits = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (shouldInjectChaos(`task-${i}`, 0.01)) hits++;
    const rate = hits / N;
    expect(rate).toBeGreaterThan(0.003);
    expect(rate).toBeLessThan(0.02);
  });

  it("rejeita task_id vazio", () => {
    expect(shouldInjectChaos("", 0.5)).toBe(false);
  });
});
