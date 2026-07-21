import { simulateScenario, DEFAULT_POLICY } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";
const scenarios = generateScenarios(500);
let ok = 0, degraded = 0, dlq = 0, breaches = 0;
const failByReason: Record<string, number> = {};
for (const s of scenarios) {
  const r = simulateScenario(s, DEFAULT_POLICY);
  if (r.finalStatus === "success") ok++;
  else if (r.finalStatus === "degraded") degraded++;
  else { dlq++; failByReason[r.failureReason ?? "unknown"] = (failByReason[r.failureReason ?? "unknown"] ?? 0) + 1; }
  if (r.slaBreached) breaches++;
}
const out = { total: scenarios.length, ok, degraded, dlq, breaches, failByReason };
console.log(JSON.stringify(out, null, 2));
await Bun.write("/mnt/documents/scrape-engine-post-1-2-4-5-6-7-8.json", JSON.stringify(out, null, 2));
