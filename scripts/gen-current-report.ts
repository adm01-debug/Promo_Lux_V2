import { simulateScenario, DEFAULT_POLICY } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";
const scenarios = generateScenarios(500);
const perScenario = scenarios.map((s) => {
  const r = simulateScenario(s, DEFAULT_POLICY);
  return { id: r.spec.id, successRate: r.successRate, dlqRate: r.dlqRate, p95: r.p95ResolutionSecs, meanAttempts: r.meanAttempts, slaBreachRate: r.slaBreachRate };
});
const n = scenarios.length;
const summary = {
  total_scenarios: n,
  avg_success_rate: perScenario.reduce((a,b)=>a+b.successRate,0)/n,
  avg_dlq_rate: perScenario.reduce((a,b)=>a+b.dlqRate,0)/n,
  avg_sla_breach_rate: perScenario.reduce((a,b)=>a+b.slaBreachRate,0)/n,
  avg_attempts: perScenario.reduce((a,b)=>a+b.meanAttempts,0)/n,
  worst5: [...perScenario].sort((a,b)=>a.successRate-b.successRate).slice(0,5),
};
await Bun.write("public/reports/current.json", JSON.stringify({ summary, perScenario, policy: DEFAULT_POLICY, label: "pós-rodada (política otimizada 5/300/6)" }, null, 2));
console.log("current avg success:", summary.avg_success_rate);
