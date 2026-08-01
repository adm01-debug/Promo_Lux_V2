// Rodada #19 — Preflight: mesmo cálculo do Round18, com gate mais rígido (0.5pp).
import { readFileSync, writeFileSync } from "node:fs";
import { simulateScenario, DEFAULT_POLICY } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";

function summarize(label: string, count: number) {
  const scenarios = generateScenarios(count);
  let s = 0, d = 0, br = 0, at = 0;
  const per: Array<{ id: string; successRate: number; dlqRate: number; p95: number }> = [];
  for (const sc of scenarios) {
    const r = simulateScenario(sc, DEFAULT_POLICY);
    s += r.successRate; d += r.dlqRate; br += r.slaBreachRate; at += r.meanAttempts;
    per.push({ id: r.spec.id, successRate: r.successRate, dlqRate: r.dlqRate, p95: r.p95ResolutionSecs });
  }
  const n = scenarios.length;
  return {
    label,
    total_scenarios: n,
    avg_success_rate: s / n,
    avg_dlq_rate: d / n,
    avg_sla_breach_rate: br / n,
    avg_attempts: at / n,
    worst5: per.sort((a, b) => a.successRate - b.successRate).slice(0, 5),
  };
}

const genericPreflight = summarize("generic-528", 528);
const webCurrent = JSON.parse(readFileSync("public/reports/web-scrape-current.json", "utf8")).summary;
const webRound17 = JSON.parse(readFileSync("public/reports/web-scrape-round17.json", "utf8")).current;

const successDelta = webCurrent.avg_success_rate - webRound17.avg_success_rate;
const dlqDelta = webCurrent.avg_dlq_rate - webRound17.avg_dlq_rate;

const regressionGate = {
  success_delta_pp: successDelta * 100,
  dlq_delta_pp: dlqDelta * 100,
  passed: successDelta * 100 >= -0.5 && dlqDelta * 100 <= 0.5,
};

const output = {
  generated_at: new Date().toISOString(),
  round: 19,
  phase: "preflight",
  regression_gate: regressionGate,
  engines: { generic: genericPreflight, web_current: webCurrent, web_round17: webRound17 },
};

writeFileSync("public/reports/round19-preflight.json", JSON.stringify(output, null, 2));
console.log("Round19 preflight:", JSON.stringify(regressionGate, null, 2));
