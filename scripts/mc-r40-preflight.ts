/**
 * Rodada #40 — Simulação Monte Carlo pós-hardening (600 cenários × 200 trials).
 * Valida a política atual, breaker e classifica gaps por severidade.
 */
import { simulateScenario, DEFAULT_POLICY, DEFAULT_BREAKER_SIM } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";
import { buildGapReport, DEFAULT_THRESHOLDS } from "../src/lib/resilience/report";

const scenarios = generateScenarios();
const seed = 4040;
const t0 = performance.now();
const results = scenarios.map((s) => simulateScenario(s, DEFAULT_POLICY, 200, seed, DEFAULT_BREAKER_SIM));
const report = buildGapReport(results, DEFAULT_THRESHOLDS);

const bySev = { critical: 0, warning: 0, info: 0 } as Record<string, number>;
for (const g of report.gaps) bySev[g.severity] = (bySev[g.severity] ?? 0) + 1;

console.log(`R40 · cenários=${report.totalScenarios} · passing=${report.passing} · gaps=${report.gaps.length}`);
console.log(`  crítico=${bySev.critical} · warning=${bySev.warning} · info=${bySev.info}`);
console.log(`  elapsed=${(performance.now() - t0).toFixed(0)}ms`);

console.log("\nTop 10 gaps por severidade:");
for (const g of report.gaps.slice(0, 10)) {
  console.log(
    `  [${g.severity.padEnd(8)}] ${g.scenarioId} · dlq=${(g.dlqRate * 100).toFixed(1)}% · sla=${(g.slaBreachRate * 100).toFixed(1)}% · p95=${g.p95ResolutionSecs.toFixed(0)}s`,
  );
}
