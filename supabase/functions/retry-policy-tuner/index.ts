// Auto-tuner de política de retry — cron diário.
// Rodada #17: agora processa dois motores em uma execução — `scrape` (fila
// legada) e `web` (motor de scrape web nativo). Cada motor gera um advisory
// independente em `retry_policy_advisories.queue_kind`.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Policy = { maxAttempts: number; baseDelaySecs: number; maxDelaySecs: number; jitterPct: number };

const CURRENT_BY_KIND: Record<"scrape" | "web", Policy> = {
  scrape: { maxAttempts: 6, baseDelaySecs: 5, maxDelaySecs: 300, jitterPct: 0.2 },
  web: { maxAttempts: 4, baseDelaySecs: 20, maxDelaySecs: 240, jitterPct: 0.35 },
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function candidatesFor(current: Policy): Policy[] {
  return [
    { ...current, baseDelaySecs: Math.max(current.baseDelaySecs - 1, 1), maxAttempts: current.maxAttempts + 1 },
    { ...current, baseDelaySecs: current.baseDelaySecs + 1, maxDelaySecs: current.maxDelaySecs + 60 },
    { ...current, maxAttempts: Math.max(current.maxAttempts - 1, 2), maxDelaySecs: Math.max(current.maxDelaySecs - 60, 60) },
    { ...current, maxAttempts: current.maxAttempts + 2 },
  ];
}

async function observedFailureRate(
  supa: SupabaseClient,
  kind: "scrape" | "web",
): Promise<{ sampleSize: number; failureRate: number }> {
  if (kind === "scrape") {
    const { data } = await supa
      .from("automation_execution_logs")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .in("phase", ["execute", "retry"])
      .limit(5000);
    const sample = data ?? [];
    const failures = sample.filter((r: { status: string }) => ["failed", "timeout", "error"].includes(r.status)).length;
    return { sampleSize: sample.length, failureRate: sample.length ? failures / sample.length : 0 };
  }

  // web: contar tarefas concluídas vs falhas na fila web nas últimas 24h.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supa
    .from("web_scrape_queue")
    .select("status")
    .gte("updated_at", since)
    .in("status", ["succeeded", "failed", "dead"])
    .limit(5000);
  const sample = data ?? [];
  const failures = sample.filter((r: { status: string }) => r.status === "failed" || r.status === "dead").length;
  return { sampleSize: sample.length, failureRate: sample.length ? failures / sample.length : 0 };
}

async function tuneKind(supa: SupabaseClient, kind: "scrape" | "web") {
  const current = CURRENT_BY_KIND[kind];
  const { sampleSize, failureRate } = await observedFailureRate(supa, kind);
  if (sampleSize < 50) return { kind, skipped: "insufficient_sample", sample: sampleSize };

  const trials = 500;
  const currentRate = simulate(current, failureRate, trials, 1);
  let best: { pol: Policy; rate: number; delta: number; p: number } | null = null;

  for (const cand of candidatesFor(current)) {
    const rate = simulate(cand, failureRate, trials, 1);
    const delta = rate - currentRate;
    const wins: number[] = [];
    for (let k = 0; k < 20; k++) {
      const c = simulate(cand, failureRate, 100, 100 + k);
      const b = simulate(current, failureRate, 100, 100 + k);
      wins.push(c - b);
    }
    const p = bootstrapPValue(wins);
    if (delta >= 0.02 && p < 0.05 && (!best || delta > best.delta)) {
      best = { pol: cand, rate, delta, p };
    }
  }

  if (!best) return { kind, no_improvement: true, current_rate: currentRate, sample: sampleSize };

  const { data: adv, error } = await supa
    .from("retry_policy_advisories")
    .insert({
      queue_kind: kind,
      current_policy: current,
      candidate_policy: best.pol,
      observed_success_rate: currentRate,
      candidate_success_rate: best.rate,
      candidate_dlq_rate: 1 - best.rate,
      improvement_pp: best.delta,
      confidence: 1 - best.p,
      sample_size: sampleSize,
    })
    .select()
    .single();
  if (error) throw new Error(`insert_advisory_${kind}: ${error.message}`);
  return { kind, advisory_id: (adv as { id: string }).id, improvement_pp: best.delta };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results = await Promise.all([tuneKind(supa, "scrape"), tuneKind(supa, "web")]);
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
