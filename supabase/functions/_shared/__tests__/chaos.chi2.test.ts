import { describe, it, expect } from "vitest";
import { shouldInjectChaos } from "../web-scrape/chaos.ts";

// Camada A (expandida) — χ² e bordas com 100k amostras
describe("Chaos — χ² & colisões (Rodada #20)", () => {
  const rates = [0.001, 0.01, 0.05, 0.1];
  const N = 100000;

  for (const rate of rates) {
    it(`χ² para rate=${rate} em ${N} tasks (erro relativo < 5%)`, () => {
      let hits = 0;
      for (let i = 0; i < N; i++) {
        if (shouldInjectChaos(`t20-${rate}-${i}`, rate)) hits++;
      }
      const observed = hits / N;
      const relErr = Math.abs(observed - rate) / rate;
      expect(relErr).toBeLessThan(0.05);
    });
  }

  it("rate=0 absoluto (0 hits em 5.000)", () => {
    let hits = 0;
    for (let i = 0; i < 5000; i++) if (shouldInjectChaos(`z-${i}`, 0)) hits++;
    expect(hits).toBe(0);
  });

  it("rate=1 absoluto (5.000/5.000)", () => {
    let hits = 0;
    for (let i = 0; i < 5000; i++) if (shouldInjectChaos(`o-${i}`, 1)) hits++;
    expect(hits).toBe(5000);
  });

  it("Sem colisão suspeita em task_ids sequenciais (rate=0.5, ~50%)", () => {
    let hits = 0;
    const N2 = 10000;
    for (let i = 0; i < N2; i++) if (shouldInjectChaos(`seq-${i}`, 0.5)) hits++;
    const observed = hits / N2;
    expect(observed).toBeGreaterThan(0.45);
    expect(observed).toBeLessThan(0.55);
  });

  it("UUIDs v4-like — distribuição balanceada", () => {
    const uuid = (i: number) =>
      `${(i * 0x9e3779b9 >>> 0).toString(16)}-4${((i * 31) & 0xfff).toString(16)}-a${((i * 97) & 0xfff).toString(16)}`;
    let hits = 0;
    const N2 = 20000;
    for (let i = 0; i < N2; i++) if (shouldInjectChaos(uuid(i), 0.03)) hits++;
    const observed = hits / N2;
    expect(Math.abs(observed - 0.03) / 0.03).toBeLessThan(0.15);
  });
});
