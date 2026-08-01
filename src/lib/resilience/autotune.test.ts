import { describe, it, expect } from "vitest";
import {
  autoTune,
  enumeratePolicies,
  evaluatePolicy,
  scorePolicy,
  DEFAULT_SLA_BANDS,
  DEFAULT_POLICY_GRID,
} from "./autotune";
import { generateScenarios } from "./scenarios";
import { DEFAULT_POLICY } from "./simulator";

describe("autotune - score", () => {
  it("recompensa sucesso e penaliza DLQ/SLA", () => {
    const good = scorePolicy(1, 0, 0);
    const bad = scorePolicy(0, 1, 1);
    expect(good).toBe(1);
    expect(bad).toBe(0);
    expect(scorePolicy(0.9, 0.05, 0.1)).toBeGreaterThan(scorePolicy(0.7, 0.3, 0.4));
  });
});

describe("autotune - enumeração", () => {
  it("descarta políticas com cap menor que base", () => {
    const policies = enumeratePolicies(DEFAULT_POLICY_GRID);
    expect(policies.length).toBeGreaterThan(0);
    expect(policies.every((p) => p.maxDelaySecs >= p.baseDelaySecs)).toBe(true);
  });
});

describe("autotune - recomendações por faixa", () => {
  it("gera uma recomendação por faixa de SLA e nunca piora o baseline", () => {
    const scenarios = generateScenarios();
    const recs = autoTune(scenarios, { trials: 20 });

    expect(recs.length).toBe(DEFAULT_SLA_BANDS.length);
    for (const rec of recs) {
      // A melhor política encontrada é sempre >= à política padrão.
      expect(rec.best.score).toBeGreaterThanOrEqual(rec.baseline.score - 1e-9);
      expect(rec.scoreDelta).toBeGreaterThanOrEqual(-1e-9);
      expect(rec.candidates.length).toBeGreaterThan(0);
      // Candidatos ordenados por score desc.
      const scores = rec.candidates.map((c) => c.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });

  it("SLA curto tende a recomendar backoff base menor que SLA longo", () => {
    const scenarios = generateScenarios();
    const recs = autoTune(scenarios, { trials: 20 });
    const short = recs.find((r) => r.band.id === "short")!;
    const long = recs.find((r) => r.band.id === "long")!;
    expect(short.best.policy.baseDelaySecs).toBeLessThanOrEqual(
      long.best.policy.baseDelaySecs,
    );
  });

  it("avaliar a política padrão em cenários vazios retorna score perfeito", () => {
    const s = evaluatePolicy(DEFAULT_POLICY, []);
    expect(s.score).toBe(1);
  });
});
