import { simulateScenario, DEFAULT_POLICY } from "../src/lib/resilience/simulator";
import { generateScenarios } from "../src/lib/resilience/scenarios";
const scenarios = generateScenarios();
const seed = 3535;
const t0 = performance.now();
const lat: number[] = [];
for (const s of scenarios) {
  const start = performance.now();
  simulateScenario(s, DEFAULT_POLICY, 100, seed);
  lat.push(performance.now() - start);
}
lat.sort((a,b)=>a-b);
const p95 = lat[Math.floor(lat.length*0.95)];
console.log(`R35 Preflight: ${scenarios.length} cenários · p95=${p95.toFixed(2)}ms · elapsed=${(performance.now()-t0).toFixed(0)}ms`);
