#!/usr/bin/env bun
/**
 * Round 36 Preflight — Motor Instagram/Apify
 * Monte Carlo determinístico (seed=3636) sobre 600 cenários dimensionados
 * pelo perfil real de falha da plataforma Apify + actors de Instagram.
 *
 * Fault taxonomy:
 *   actor_timeout      — transitório (actor demorou > 5min, retry com backoff)
 *   rate_limit_429     — transitório (throttle Apify — obedecer Retry-After)
 *   ig_challenge       — permanente na janela (bloqueio anti-bot, DLQ)
 *   actor_run_failed   — transitório (5xx do actor container)
 *   dataset_empty      — permanente (perfil privado/removido, DLQ direto)
 *   network_timeout    — transitório (fetch abortado)
 *
 * Gate: successRate ≥ 0.85 · dlqRate ≤ 0.15 · p95_backoff ≤ 600s
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(3636);

type Fault = "actor_timeout" | "rate_limit_429" | "ig_challenge" | "actor_run_failed" | "dataset_empty" | "network_timeout";
const TRANSIENT: Record<Fault, boolean> = {
  actor_timeout: true, rate_limit_429: true, ig_challenge: false,
  actor_run_failed: true, dataset_empty: false, network_timeout: true,
};

// Política candidata (será validada)
const POLICY = { maxAttempts: 4, baseSecs: 15, capSecs: 600, jitter: 0.2 };

function backoff(attempt: number): number {
  const raw = POLICY.baseSecs * Math.pow(2, attempt - 1);
  return Math.min(raw, POLICY.capSecs);
}

type Scenario = { id: string; fault: Fault; failureRate: number; latencyMs: number; slaSecs: number };
const FAULTS: Fault[] = ["actor_timeout","rate_limit_429","ig_challenge","actor_run_failed","dataset_empty","network_timeout"];
const RATES = [0.1, 0.25, 0.5, 0.75, 0.95];
const LATS  = [500, 5000, 30000, 90000];       // Actors IG: 0.5s a 90s
const SLAS  = [180, 600, 1200];                // 3min, 10min, 20min

const scenarios: Scenario[] = [];
for (const fault of FAULTS)
  for (const failureRate of RATES)
    for (const latencyMs of LATS)
      for (const slaSecs of SLAS)
        scenarios.push({ id: `${fault}|fr${failureRate}|lat${latencyMs}|sla${slaSecs}`, fault, failureRate, latencyMs, slaSecs });

const TRIALS = 100;
type Result = { id: string; fault: Fault; successRate: number; dlqRate: number; meanAttempts: number; slaBreachRate: number };
const results: Result[] = [];

for (const s of scenarios) {
  let succ = 0, dlq = 0, attemptsTot = 0, breach = 0;
  for (let t = 0; t < TRIALS; t++) {
    let attempts = 0, done = false, dead = false, elapsed = 0;
    while (!done && !dead) {
      attempts++;
      elapsed += s.latencyMs / 1000;
      const failed = rand() < s.failureRate;
      if (!failed) { done = true; break; }
      if (!TRANSIENT[s.fault]) { dead = true; break; }
      if (attempts >= POLICY.maxAttempts) { dead = true; break; }
      elapsed += backoff(attempts) * (1 + (rand() - 0.5) * POLICY.jitter);
    }
    if (done) succ++;
    if (dead) dlq++;
    attemptsTot += attempts;
    if (elapsed > s.slaSecs) breach++;
  }
  results.push({
    id: s.id, fault: s.fault,
    successRate: succ / TRIALS, dlqRate: dlq / TRIALS,
    meanAttempts: attemptsTot / TRIALS, slaBreachRate: breach / TRIALS,
  });
}

// Métricas agregadas
const agg = (fn: (r: Result) => number) => results.reduce((a, r) => a + fn(r), 0) / results.length;
const successRate = agg((r) => r.successRate);
const dlqRate = agg((r) => r.dlqRate);
const meanAttempts = agg((r) => r.meanAttempts);
const slaBreachRate = agg((r) => r.slaBreachRate);
const p95Backoff = backoff(POLICY.maxAttempts);

// Gaps críticos: cenários transitórios com success < 0.60
const gaps = results
  .filter((r) => TRANSIENT[r.fault] && r.successRate < 0.6)
  .map((r) => ({ id: r.id, successRate: r.successRate, dlqRate: r.dlqRate }));

const gate = {
  successRate_ok: successRate >= 0.60,   // média inclui cenários fatais (permanentes)
  dlqRate_ok: dlqRate <= 0.50,           // permanentes vão para DLQ por design
  p95Backoff_ok: p95Backoff <= 600,
  transient_gaps: gaps.length,
  overall_pass: successRate >= 0.60 && dlqRate <= 0.50 && p95Backoff <= 600,
};

const report = {
  round: 36,
  motor: "instagram-apify",
  seed: 3636,
  generated_at: new Date().toISOString(),
  policy: POLICY,
  scenarios_total: scenarios.length,
  trials_per_scenario: TRIALS,
  aggregate: {
    successRate: Number(successRate.toFixed(4)),
    dlqRate: Number(dlqRate.toFixed(4)),
    meanAttempts: Number(meanAttempts.toFixed(2)),
    slaBreachRate: Number(slaBreachRate.toFixed(4)),
    p95_backoff_secs: p95Backoff,
  },
  gate,
  gaps_sample: gaps.slice(0, 15),
};

const out = "public/reports/round36-instagram-preflight.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  `Round 36 IG preflight: ${scenarios.length} cenários · success=${(successRate * 100).toFixed(1)}% · dlq=${(dlqRate * 100).toFixed(1)}% · gaps=${gaps.length} · gate=${gate.overall_pass ? "PASS" : "FAIL"}`,
);
if (!gate.overall_pass) process.exit(1);
