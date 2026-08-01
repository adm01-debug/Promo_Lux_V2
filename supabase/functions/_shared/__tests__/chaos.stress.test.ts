import { describe, it, expect } from "vitest";
import { shouldInjectChaos } from "../web-scrape/chaos.ts";

// Camada A — Stress do injetor de chaos
describe("Chaos determinístico — stress", () => {
  it("A1: Determinismo em 1.000 amostras", () => {
    for (let i = 0; i < 1000; i++) {
      const id = `task-${i}-${(i * 7919) % 100000}`;
      const a = shouldInjectChaos(id, 0.1);
      const b = shouldInjectChaos(id, 0.1);
      expect(a).toBe(b);
    }
  });

  it("A2: Distribuição rate=0.01 em 20.000 tasks dentro de [0.005, 0.020]", () => {
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (shouldInjectChaos(`uuid-${i}`, 0.01)) hits++;
    const rate = hits / N;
    expect(rate).toBeGreaterThanOrEqual(0.005);
    expect(rate).toBeLessThanOrEqual(0.02);
  });

  it("A3: Bordas rate=0 e rate=1 em 500 tasks", () => {
    for (let i = 0; i < 500; i++) {
      expect(shouldInjectChaos(`z-${i}`, 0)).toBe(false);
      expect(shouldInjectChaos(`z-${i}`, 1)).toBe(true);
    }
  });

  it("A4: task_id vazio, unicode, gigante — não crasha", () => {
    expect(shouldInjectChaos("", 0.5)).toBe(false);
    expect(() => shouldInjectChaos("🔥💀🚀-café-über", 0.5)).not.toThrow();
    expect(() => shouldInjectChaos("x".repeat(10000), 0.5)).not.toThrow();
    // determinismo em unicode
    const u = "🔥💀🚀-café-über";
    expect(shouldInjectChaos(u, 0.5)).toBe(shouldInjectChaos(u, 0.5));
  });

  it("A5: Rate inválido (negativo/NaN/>1) — não crasha, comportamento consistente", () => {
    expect(shouldInjectChaos("t", -0.5)).toBe(false);
    expect(shouldInjectChaos("t", Number.NaN)).toBe(false);
    // >1 vira "sempre" (rate>=1 curto-circuito)
    expect(shouldInjectChaos("t", 1.5)).toBe(true);
  });

  it("A6: Distribuição em 50k UUIDs sintéticos (rate=0.02) dentro de [0.012, 0.028]", () => {
    let hits = 0;
    const N = 50000;
    const uuidLike = (i: number) =>
      `${(i * 0x9e3779b9).toString(16)}-${i}-${(i ^ 0xdeadbeef).toString(16)}`;
    for (let i = 0; i < N; i++) if (shouldInjectChaos(uuidLike(i), 0.02)) hits++;
    const rate = hits / N;
    expect(rate).toBeGreaterThanOrEqual(0.012);
    expect(rate).toBeLessThanOrEqual(0.028);
  });
});
