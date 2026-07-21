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
    const scenarios = generateScenarios(500);
    const t0 = performance.now();
    for (const s of scenarios) simulateScenario(s, DEFAULT_POLICY, 100);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(5000);
  });

  it("mantém sucesso >= 70% no agregado com política default", () => {
    const scenarios = generateScenarios(300);
    let sum = 0;
    for (const s of scenarios) sum += simulateScenario(s, DEFAULT_POLICY, 100).successRate;
    expect(sum / scenarios.length).toBeGreaterThanOrEqual(0.7);
  });

  it("cenários client_4xx com failureRate 0.95 vão majoritariamente para DLQ (comportamento correto)", () => {
    const scenarios = generateScenarios(500).filter(
      (s) => s.fault === "client_4xx" && s.failureRate >= 0.9,
    );
    expect(scenarios.length).toBeGreaterThan(0);
    for (const s of scenarios) {
      const r = simulateScenario(s, DEFAULT_POLICY, 200);
      expect(r.dlqRate).toBeGreaterThan(0.85);
    }
  });
});
