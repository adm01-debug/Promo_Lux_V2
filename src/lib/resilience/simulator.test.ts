import { describe, it, expect } from "vitest";
import {
  simulateScenario,
  backoffSecs,
  DEFAULT_POLICY,
  FAULT_TRANSIENT,
  type ScenarioSpec,
} from "./simulator";
import { generateScenarios } from "./scenarios";
import { buildGapReport, DEFAULT_THRESHOLDS } from "./report";

describe("simulator - backoff", () => {
  it("cresce exponencialmente e respeita o cap", () => {
    const noJitter = () => 0;
    expect(backoffSecs(1, DEFAULT_POLICY, noJitter)).toBe(30);
    expect(backoffSecs(2, DEFAULT_POLICY, noJitter)).toBe(60);
    expect(backoffSecs(3, DEFAULT_POLICY, noJitter)).toBe(120);
    // cap em 3600
    expect(backoffSecs(20, DEFAULT_POLICY, noJitter)).toBe(3600);
  });
});

describe("simulator - cenários", () => {
  it("erro permanente (4xx) sempre vai para DLQ quando falha", () => {
    const spec: ScenarioSpec = {
      id: "client_4xx|test",
      fault: "client_4xx",
      failureRate: 1,
      latencyMs: 100,
      slaSecs: 60,
    };
    const r = simulateScenario(spec, DEFAULT_POLICY, 100);
    expect(FAULT_TRANSIENT.client_4xx).toBe(false);
    expect(r.dlqRate).toBe(1);
    expect(r.meanAttempts).toBe(1); // sem retries
  });

  it("falha 100% transitória esgota tentativas e vai para DLQ", () => {
    const spec: ScenarioSpec = {
      id: "timeout|test",
      fault: "timeout",
      failureRate: 1,
      latencyMs: 100,
      slaSecs: 60,
    };
    const r = simulateScenario(spec, DEFAULT_POLICY, 100);
    expect(r.dlqRate).toBe(1);
    expect(r.meanAttempts).toBe(DEFAULT_POLICY.maxAttempts);
  });

  it("falha 0% sempre resolve na primeira tentativa", () => {
    const spec: ScenarioSpec = {
      id: "server_5xx|test",
      fault: "server_5xx",
      failureRate: 0,
      latencyMs: 100,
      slaSecs: 60,
    };
    const r = simulateScenario(spec, DEFAULT_POLICY, 100);
    expect(r.successRate).toBe(1);
    expect(r.dlqRate).toBe(0);
  });

  it("é determinístico com a mesma seed", () => {
    const spec: ScenarioSpec = {
      id: "unavailable|test",
      fault: "unavailable",
      failureRate: 0.5,
      latencyMs: 500,
      slaSecs: 120,
    };
    const a = simulateScenario(spec, DEFAULT_POLICY, 200, 42);
    const b = simulateScenario(spec, DEFAULT_POLICY, 200, 42);
    expect(a.successRate).toBe(b.successRate);
    expect(a.dlqRate).toBe(b.dlqRate);
  });
});

describe("scenarios + report", () => {
  it("gera centenas de cenários e produz relatório de gaps", () => {
    const scenarios = generateScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(300);

    const results = scenarios.map((s) => simulateScenario(s, DEFAULT_POLICY, 60));
    const report = buildGapReport(results, DEFAULT_THRESHOLDS);

    expect(report.totalScenarios).toBe(scenarios.length);
    expect(report.passing + new Set(report.gaps.map((g) => g.scenarioId)).size).toBe(
      scenarios.length,
    );
    // Cenários com falha alta devem produzir gaps.
    expect(report.gaps.length).toBeGreaterThan(0);
    // Gaps ordenados por severidade (críticos primeiro).
    const ranks = report.gaps.map((g) =>
      g.severity === "critical" ? 3 : g.severity === "warning" ? 2 : 1,
    );
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });
});
