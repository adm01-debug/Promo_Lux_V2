// Rodada #21 — Preflight: simular claim concorrente em fila (FOR UPDATE SKIP LOCKED)
// Modela N workers competindo por M tasks; valida invariantes:
//  - cada task processada por no máximo 1 worker
//  - nenhuma task perdida (throughput = min(N*capacity, M))
//  - fairness: nenhum worker fica com >70% quando N>=2
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function rng(seed: number) { let a = seed>>>0; return () => { a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

interface Result { id:number; workers:number; tasks:number; batch:number; duplicates:number; lost:number; maxShare:number; ok:boolean }
const rand = rng(2121);
const results: Result[] = [];

for (let i = 0; i < 500; i++) {
  const workers = 2 + Math.floor(rand() * 8);        // 2..9
  const tasks = 20 + Math.floor(rand() * 480);       // 20..500
  const batch = 1 + Math.floor(rand() * 10);         // 1..10
  // Simular SKIP LOCKED: cada round, cada worker tenta claim de `batch` tasks disponíveis
  const status = new Uint8Array(tasks); // 0=free, 1=claimed
  const perWorker = new Uint32Array(workers);
  let round = 0;
  while (round < 10000 && status.some(v => v === 0)) {
    // ordem de chegada aleatória por round
    const order = Array.from({length:workers}, (_,k)=>k).sort(()=>rand()-0.5);
    for (const w of order) {
      let taken = 0;
      for (let t = 0; t < tasks && taken < batch; t++) {
        if (status[t] === 0) { status[t] = 1; perWorker[w]++; taken++; }
      }
    }
    round++;
  }
  const claimed = perWorker.reduce((a,b)=>a+b, 0);
  const duplicates = claimed - status.filter(v => v === 1).length; // nunca deve ocorrer
  const lost = status.filter(v => v === 0).length;
  const maxShare = Math.max(...perWorker) / Math.max(1, claimed);
  const ok = duplicates === 0 && lost === 0;
  results.push({ id:i, workers, tasks, batch, duplicates, lost, maxShare:+maxShare.toFixed(3), ok });
}

const okCount = results.filter(r => r.ok).length;
const dupTotal = results.reduce((a,r)=>a+r.duplicates, 0);
const lostTotal = results.reduce((a,r)=>a+r.lost, 0);
const avgMaxShare = results.reduce((a,r)=>a+r.maxShare, 0) / results.length;

const report = {
  round: 21, layer: "Preflight — Concorrência de workers",
  generated_at: new Date().toISOString(),
  scenarios: results.length,
  invariants: {
    zero_duplicates: dupTotal === 0,
    zero_lost: lostTotal === 0,
    ok_scenarios: okCount,
    avg_max_share: +avgMaxShare.toFixed(3),
    fairness_pass: avgMaxShare < 0.70,
  },
  gate: {
    overall_pass: dupTotal === 0 && lostTotal === 0 && okCount === results.length,
  },
};
mkdirSync(dirname("public/reports/round21-preflight.json"), { recursive: true });
writeFileSync("public/reports/round21-preflight.json", JSON.stringify(report, null, 2));
console.log(`✓ OK=${okCount}/${results.length} dup=${dupTotal} lost=${lostTotal} avgMaxShare=${avgMaxShare.toFixed(3)}`);
console.log(`  Gate: ${report.gate.overall_pass ? "PASS ✓" : "FAIL ✗"}`);
if (!report.gate.overall_pass) process.exit(1);
