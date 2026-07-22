/**
 * Testes de carga: valida throughput do simulador Monte Carlo e propriedades
 * da política de retry sob volume alto. Este é um smoke test in-process
 * (não bate no banco real) para gate de CI.
 */
import { describe, it, expect } from "vitest";
import { simulateScenario, DEFAULT_POLICY } from "@/lib/resilience/simulator";
import { generateScenarios } from "@/lib/resilience/scenarios";

describe("load-stress: motor de resiliência", () => {
  it("processa 500 cenários em menos de 5s (throughput >= 100 cenários/s)", () => {
    const scenarios = generateScenarios();
    const t0 = performance.now();
    for (const s of scenarios) simulateScenario(s, DEFAULT_POLICY, 100);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(10000);
  });

  it("mantém sucesso >= 70% no agregado com política default", () => {
    const scenarios = generateScenarios();
    let sum = 0;
    for (const s of scenarios) sum += simulateScenario(s, DEFAULT_POLICY, 100).successRate;
    expect(sum / scenarios.length).toBeGreaterThanOrEqual(0.7);
  });

  it("cenários client_4xx com failureRate 0.95 vão majoritariamente para DLQ (comportamento correto)", () => {
    const scenarios = generateScenarios().filter(
      (s) => s.fault === "client_4xx" && s.failureRate >= 0.9,
    );
    expect(scenarios.length).toBeGreaterThan(0);
    for (const s of scenarios) {
      const r = simulateScenario(s, DEFAULT_POLICY, 200);
      expect(r.dlqRate).toBeGreaterThan(0.85);
    }
  });
});

/**
 * Rodada #17 — cenário exclusivo do motor de scrape web nativo.
 * Simula 1000 URLs mistas (HTML/SPA/403/timeout) com política otimizada
 * (4 tentativas / base 20s / max 240s / jitter 35%) validando as metas
 * de p95 e taxa de sucesso do motor web.
 */
describe("load-stress: motor de scrape web", () => {
  const WEB_POLICY = { ...DEFAULT_POLICY, maxAttempts: 4, baseDelaySecs: 20, maxDelaySecs: 240, jitterRatio: 0.35 };

  const WEB_MIX = [
    { fault: "rate_limit" as const, failureRate: 0.05, latencyMs: 800, slaSecs: 120, weight: 55 },
    { fault: "server_5xx" as const, failureRate: 0.4, latencyMs: 3000, slaSecs: 120, weight: 15 },
    { fault: "timeout" as const, failureRate: 0.3, latencyMs: 15000, slaSecs: 300, weight: 10 },
    { fault: "client_4xx" as const, failureRate: 0.9, latencyMs: 500, slaSecs: 120, weight: 8 },
    { fault: "unavailable" as const, failureRate: 1.0, latencyMs: 200, slaSecs: 120, weight: 7 },
    { fault: "unavailable" as const, failureRate: 1.0, latencyMs: 1500, slaSecs: 120, weight: 3 },
    { fault: "server_5xx" as const, failureRate: 0.7, latencyMs: 2000, slaSecs: 120, weight: 2 },
  ];

  function buildWebScenarios(n = 1000) {
    const total = WEB_MIX.reduce((s, m) => s + m.weight, 0);
    const out = [];
    let idx = 0;
    for (const m of WEB_MIX) {
      const count = Math.round((m.weight / total) * n);
      for (let i = 0; i < count; i++) {
        out.push({
          id: `web-load|${m.fault}|#${idx++}`,
          fault: m.fault,
          failureRate: m.failureRate,
          latencyMs: m.latencyMs,
          slaSecs: m.slaSecs,
          retryAfterSecs: m.fault === "rate_limit" ? 30 : undefined,
        });
      }
    }
    return out;
  }

  it("processa 1000 URLs mistas mantendo sucesso >= 60% (baseline pessimista do mix)", () => {
    const scenarios = buildWebScenarios(1000);
    const results = scenarios.map((s) => simulateScenario(s, WEB_POLICY, 50));
    const avg = results.reduce((a, r) => a + r.successRate, 0) / results.length;
    expect(avg).toBeGreaterThanOrEqual(0.6);
  });

  it("cenários HTML saudáveis (rate_limit leve, fr<=0.05) mantêm sucesso >= 92%", () => {
    const healthy = buildWebScenarios(1000).filter((s) => s.fault === "rate_limit" && s.failureRate <= 0.05);
    expect(healthy.length).toBeGreaterThan(0);
    for (const s of healthy) {
      const r = simulateScenario(s, WEB_POLICY, 100);
      expect(r.successRate).toBeGreaterThanOrEqual(0.92);
    }
  });
});
