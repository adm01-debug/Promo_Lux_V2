/**
 * Auto-tuning da política de retry por faixa de SLA.
 *
 * Motivação: uma única política fixa (maxAttempts/base/cap) é subótima quando
 * os SLAs variam bastante. Um SLA curto (ex.: 30s) precisa de backoff pequeno
 * e poucas tentativas — caso contrário toda retentativa já estoura o prazo e só
 * engorda a DLQ. Um SLA longo (ex.: 600s) tolera backoff maior e mais
 * tentativas, elevando a taxa de sucesso sem violar o prazo.
 *
 * Este módulo faz uma busca em grade (grid search) sobre políticas candidatas,
 * avaliando cada uma via Monte Carlo contra os cenários de uma faixa de SLA, e
 * recomenda a melhor política por faixa segundo um score multiobjetivo.
 */

import {
  simulateScenario,
  type RetryPolicy,
  type ScenarioSpec,
  type BreakerSimConfig,
  DEFAULT_POLICY,
  DEFAULT_BREAKER_SIM,
} from "./simulator";

/** Faixa de SLA (segundos) usada para segmentar cenários e políticas. */
export interface SlaBand {
  id: string;
  label: string;
  /** Limite inferior inclusivo (s). */
  minSecs: number;
  /** Limite superior exclusivo (s); Infinity para a última faixa. */
  maxSecs: number;
}

/** Faixas padrão: curto / médio / longo. */
export const DEFAULT_SLA_BANDS: SlaBand[] = [
  { id: "short", label: "Curto (≤ 60s)", minSecs: 0, maxSecs: 61 },
  { id: "medium", label: "Médio (61–300s)", minSecs: 61, maxSecs: 301 },
  { id: "long", label: "Longo (> 300s)", minSecs: 301, maxSecs: Infinity },
];

/** Pesos do score multiobjetivo (somam 1). */
export interface TuningWeights {
  success: number;
  dlq: number;
  slaBreach: number;
}

export const DEFAULT_WEIGHTS: TuningWeights = {
  success: 0.5,
  dlq: 0.3,
  slaBreach: 0.2,
};

/** Espaço de busca das políticas candidatas. */
export interface PolicyGrid {
  maxAttempts: number[];
  baseDelaysSecs: number[];
  maxDelaysSecs: number[];
  jitterPct: number;
}

export const DEFAULT_POLICY_GRID: PolicyGrid = {
  maxAttempts: [2, 3, 4, 5, 6, 8],
  baseDelaysSecs: [2, 5, 10, 30, 60],
  maxDelaysSecs: [120, 600, 1800, 3600],
  jitterPct: 0.2,
};

export interface PolicyScore {
  policy: RetryPolicy;
  successRate: number;
  dlqRate: number;
  slaBreachRate: number;
  /** Score agregado [0..1]; maior é melhor. */
  score: number;
}

export interface BandRecommendation {
  band: SlaBand;
  scenarioCount: number;
  best: PolicyScore;
  baseline: PolicyScore;
  /** Ganho absoluto de score sobre a política padrão. */
  scoreDelta: number;
  /** Runner-ups para inspeção/transparência. */
  candidates: PolicyScore[];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Score multiobjetivo: recompensa sucesso, penaliza DLQ e violação de SLA. */
export function scorePolicy(
  successRate: number,
  dlqRate: number,
  slaBreachRate: number,
  weights: TuningWeights = DEFAULT_WEIGHTS,
): number {
  const s =
    weights.success * successRate +
    weights.dlq * (1 - dlqRate) +
    weights.slaBreach * (1 - slaBreachRate);
  return clamp01(s);
}

/** Avalia uma política contra um conjunto de cenários (média das métricas). */
export function evaluatePolicy(
  policy: RetryPolicy,
  scenarios: ScenarioSpec[],
  weights: TuningWeights = DEFAULT_WEIGHTS,
  trials = 60,
  breaker: BreakerSimConfig | null = DEFAULT_BREAKER_SIM,
): PolicyScore {
  if (scenarios.length === 0) {
    return { policy, successRate: 1, dlqRate: 0, slaBreachRate: 0, score: 1 };
  }
  let success = 0;
  let dlq = 0;
  let sla = 0;
  for (const spec of scenarios) {
    const r = simulateScenario(spec, policy, trials, 7, breaker);
    success += r.successRate;
    dlq += r.dlqRate;
    sla += r.slaBreachRate;
  }
  const n = scenarios.length;
  const successRate = success / n;
  const dlqRate = dlq / n;
  const slaBreachRate = sla / n;
  return {
    policy,
    successRate,
    dlqRate,
    slaBreachRate,
    score: scorePolicy(successRate, dlqRate, slaBreachRate, weights),
  };
}

/** Gera todas as políticas do espaço de busca. */
export function enumeratePolicies(grid: PolicyGrid = DEFAULT_POLICY_GRID): RetryPolicy[] {
  const out: RetryPolicy[] = [];
  for (const maxAttempts of grid.maxAttempts) {
    for (const baseDelaySecs of grid.baseDelaysSecs) {
      for (const maxDelaySecs of grid.maxDelaysSecs) {
        // Descarta combinações incoerentes (cap menor que o base).
        if (maxDelaySecs < baseDelaySecs) continue;
        out.push({
          maxAttempts,
          baseDelaySecs,
          maxDelaySecs,
          jitterPct: grid.jitterPct,
        });
      }
    }
  }
  return out;
}

function bandOf(slaSecs: number, bands: SlaBand[]): SlaBand | undefined {
  return bands.find((b) => slaSecs >= b.minSecs && slaSecs < b.maxSecs);
}

/**
 * Executa o auto-tuning: para cada faixa de SLA, busca a melhor política e a
 * compara com a política padrão vigente.
 */
export function autoTune(
  scenarios: ScenarioSpec[],
  opts: {
    bands?: SlaBand[];
    grid?: PolicyGrid;
    weights?: TuningWeights;
    trials?: number;
    breaker?: BreakerSimConfig | null;
    topN?: number;
  } = {},
): BandRecommendation[] {
  const bands = opts.bands ?? DEFAULT_SLA_BANDS;
  const grid = opts.grid ?? DEFAULT_POLICY_GRID;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const trials = opts.trials ?? 40;
  const breaker = opts.breaker === undefined ? DEFAULT_BREAKER_SIM : opts.breaker;
  const topN = opts.topN ?? 3;

  const policies = enumeratePolicies(grid);

  return bands.map((band) => {
    const bandScenarios = scenarios.filter((s) => bandOf(s.slaSecs, bands)?.id === band.id);

    const scored = policies
      .map((p) => evaluatePolicy(p, bandScenarios, weights, trials, breaker))
      .sort((a, b) => b.score - a.score);

    const best = scored[0] ?? evaluatePolicy(DEFAULT_POLICY, bandScenarios, weights, trials, breaker);
    const baseline = evaluatePolicy(DEFAULT_POLICY, bandScenarios, weights, trials, breaker);

    return {
      band,
      scenarioCount: bandScenarios.length,
      best,
      baseline,
      scoreDelta: best.score - baseline.score,
      candidates: scored.slice(0, topN),
    };
  });
}
