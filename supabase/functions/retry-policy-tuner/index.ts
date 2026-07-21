// Auto-tuner de política de retry — cron diário.
// Lê métricas reais das últimas 24h e roda mini-Monte Carlo com variantes.
// Se um candidato bate o current com folga (>=2pp e p<0.05 via bootstrap),
// grava recomendação em retry_policy_advisories para admin revisar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Policy = { maxAttempts: number; baseDelaySecs: number; maxDelaySecs: number; jitterPct: number };
const CURRENT: Policy = { maxAttempts: 6, baseDelaySecs: 5, maxDelaySecs: 300, jitterPct: 0.2 };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simula um cenário simplificado com failure rate agregado observado
function simulate(policy: Policy, failureRate: number, trials: number, seed: number): number {
  const rand = mulberry32(seed);
  let ok = 0;
  for (let t = 0; t < trials; t++) {
    for (let a = 0; a < policy.maxAttempts; a++) {
      if (rand() >= failureRate) { ok++; break; }
    }
  }
  return ok / trials;
}

// Bootstrap CI: retorna p-value one-sided (candidate > current)
function bootstrapPValue(candidateWins: number[], iterations = 1000): number {
  const rand = mulberry32(42);
  let ge = 0;
  const n = candidateWins.length;
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += candidateWins[Math.floor(rand() * n)];
    if (sum / n <= 0) ge++;
  }
  return ge / iterations;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Failure rate observado nas últimas 24h em scrape_queue via automation_execution_logs
    const { data: rows } = await supa
      .from("automation_execution_logs")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .in("phase", ["execute", "retry"])
      .limit(5000);

    const sample = rows ?? [];
    if (sample.length < 50) {
      return new Response(JSON.stringify({ ok: true, skipped: "insufficient_sample", sample: sample.length }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const failures = sample.filter((r: any) => ["failed", "timeout", "error"].includes(r.status)).length;
    const observedFailureRate = failures / sample.length;

    // Candidatos ±20% em base/max/attempts
    const candidates: Policy[] = [
      { ...CURRENT, baseDelaySecs: 4, maxAttempts: 7 },
      { ...CURRENT, baseDelaySecs: 6, maxDelaySecs: 360 },
      { ...CURRENT, maxAttempts: 5, maxDelaySecs: 240 },
      { ...CURRENT, maxAttempts: 8 },
    ];

    const trials = 500;
    const currentRate = simulate(CURRENT, observedFailureRate, trials, 1);
    let best: { pol: Policy; rate: number; delta: number; p: number } | null = null;

    for (const cand of candidates) {
      const rate = simulate(cand, observedFailureRate, trials, 1);
      const delta = rate - currentRate;
      // Bootstrap: 20 mini-runs para estimar variância
      const wins: number[] = [];
      for (let k = 0; k < 20; k++) {
        const c = simulate(cand, observedFailureRate, 100, 100 + k);
        const b = simulate(CURRENT, observedFailureRate, 100, 100 + k);
        wins.push(c - b);
      }
      const p = bootstrapPValue(wins);
      if (delta >= 0.02 && p < 0.05 && (!best || delta > best.delta)) {
        best = { pol: cand, rate, delta, p };
      }
    }

    if (!best) {
      return new Response(JSON.stringify({ ok: true, no_improvement: true, current_rate: currentRate }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: adv, error } = await supa
      .from("retry_policy_advisories")
      .insert({
        current_policy: CURRENT,
        candidate_policy: best.pol,
        observed_success_rate: currentRate,
        candidate_success_rate: best.rate,
        candidate_dlq_rate: 1 - best.rate,
        improvement_pp: best.delta,
        confidence: 1 - best.p,
        sample_size: sample.length,
      })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, advisory: adv }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
