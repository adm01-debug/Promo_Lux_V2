import { simulateScenario, DEFAULT_POLICY } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";
const scenarios = generateScenarios(500);
let totalSuccess = 0, totalDlq = 0, totalBreach = 0, totalAttempts = 0;
const perScenario: Array<{ id: string; successRate: number; dlqRate: number; p95: number }> = [];
for (const s of scenarios) {
  const r = simulateScenario(s, DEFAULT_POLICY);
  totalSuccess += r.successRate;
  totalDlq += r.dlqRate;
  totalBreach += r.slaBreachRate;
  totalAttempts += r.meanAttempts;
  perScenario.push({ id: r.spec.id, successRate: r.successRate, dlqRate: r.dlqRate, p95: r.p95ResolutionSecs });
}
const n = scenarios.length;
const summary = {
  total_scenarios: n,
  avg_success_rate: totalSuccess / n,
  avg_dlq_rate: totalDlq / n,
  avg_sla_breach_rate: totalBreach / n,
  avg_attempts: totalAttempts / n,
  worst5: perScenario.sort((a, b) => a.successRate - b.successRate).slice(0, 5),
};
console.log(JSON.stringify(summary, null, 2));
await Bun.write("/mnt/documents/scrape-engine-post-improvements.json", JSON.stringify({ summary, perScenario }, null, 2));
