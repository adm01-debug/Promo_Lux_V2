/**
 * Simulador de Resiliência — modelo de domínio.
 *
 * Modela o comportamento real do sistema de fila (fail_scrape_task):
 *  - backoff exponencial com jitter (base 30s, cap 3600s, 20% jitter)
 *  - até max_attempts tentativas
 *  - erros transitórios são reprocessados; permanentes vão direto p/ DLQ
 *  - circuit breaker (gmaps-proxy): 5 falhas em 60s abre o circuito
 *
 * O objetivo é executar centenas de cenários ANTES de produção e revelar
 * gaps: taxa de DLQ alta, violação de SLA, falhas silenciosas, etc.
 */

export type FaultType =
  | "timeout"
  | "rate_limit"
  | "server_5xx"
  | "client_4xx"
  | "unavailable";

/** Classificação: transitório (retry) vs permanente (DLQ imediato). */
export const FAULT_TRANSIENT: Record<FaultType, boolean> = {
  timeout: true,
  rate_limit: true,
  server_5xx: true,
  unavailable: true,
  client_4xx: false,
};

export const FAULT_LABEL: Record<FaultType, string> = {
  timeout: "Timeout",
  rate_limit: "Rate limit (429)",
  server_5xx: "Erro servidor (5xx)",
  client_4xx: "Erro cliente (4xx)",
  unavailable: "Indisponibilidade",
};

export interface RetryPolicy {
  maxAttempts: number;
  baseDelaySecs: number;
  maxDelaySecs: number;
  jitterPct: number;
}

/** Política padrão espelhando fail_scrape_task no banco. */
export const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelaySecs: 30,
  maxDelaySecs: 3600,
  jitterPct: 0.2,
};

export interface CircuitBreakerConfig {
  threshold: number;
  resetTimeoutSecs: number;
}

export const DEFAULT_BREAKER: CircuitBreakerConfig = {
  threshold: 5,
  resetTimeoutSecs: 60,
};

export interface ScenarioSpec {
  id: string;
  fault: FaultType;
  /** Probabilidade [0..1] de a chamada falhar em cada tentativa. */
  failureRate: number;
  /** Latência da chamada externa, em ms. */
  latencyMs: number;
  /** SLA de resolução, em segundos. */
  slaSecs: number;
  /** Retry-After anunciado pelo provedor em rate_limit, em segundos. */
  retryAfterSecs?: number;
}

export interface ScenarioResult {
  spec: ScenarioSpec;
  trials: number;
  successRate: number;
  dlqRate: number;
  slaBreachRate: number;
  meanAttempts: number;
  p95ResolutionSecs: number;
  meanResolutionSecs: number;
}

/** PRNG determinístico (mulberry32) para reprodutibilidade. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Backoff exponencial com jitter, em segundos (espelha o banco). */
export function backoffSecs(
  attempt: number,
  policy: RetryPolicy,
  rand: () => number,
): number {
  const base = Math.min(
    policy.baseDelaySecs * Math.pow(2, attempt - 1),
    policy.maxDelaySecs,
  );
  const jitter = base * policy.jitterPct * rand();
  return base + jitter;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/**
 * Executa uma simulação Monte Carlo de um cenário.
 * Retorna métricas agregadas sobre `trials` execuções independentes.
 */
export interface BreakerSimConfig {
  /** Falhas consecutivas que abrem o circuito (equivale a threshold no banco). */
  threshold: number;
  /** Tempo de espera enquanto o circuito está aberto, em segundos. */
  resetTimeoutSecs: number;
  /**
   * Máximo de deferrals (esperas por recuperação do provedor) antes de
   * finalmente mandar a tarefa para a DLQ. Um deferral NÃO consome tentativa —
   * espelha `defer_scrape_task` no banco: a tarefa apenas aguarda o provedor.
   */
  maxDeferrals: number;
}

/** Breaker padrão — espelha a linha `gmaps` em public.circuit_breakers. */
export const DEFAULT_BREAKER_SIM: BreakerSimConfig = {
  threshold: 3,
  resetTimeoutSecs: 60,
  maxDeferrals: 6,
};

export function simulateScenario(
  spec: ScenarioSpec,
  policy: RetryPolicy = DEFAULT_POLICY,
  trials = 200,
  seed = 1,
  breaker: BreakerSimConfig | null = null,
): ScenarioResult {
  const rand = mulberry32(seed + hashId(spec.id));
  const transient = FAULT_TRANSIENT[spec.fault];

  let successes = 0;
  let dlq = 0;
  let slaBreaches = 0;
  let attemptsSum = 0;
  const resolutionTimes: number[] = [];

  for (let t = 0; t < trials; t++) {
    let attempts = 0;
    let elapsedSecs = 0;
    let outcome: "success" | "dlq" = "dlq";
    let consecutiveFails = 0;
    let deferrals = 0;

    while (attempts < policy.maxAttempts) {
      // Circuit breaker: provedor degradado → adia sem gastar tentativa.
      if (
        breaker &&
        transient &&
        consecutiveFails >= breaker.threshold
      ) {
        if (deferrals >= breaker.maxDeferrals) {
          outcome = "dlq";
          break;
        }
        deferrals++;
        elapsedSecs += breaker.resetTimeoutSecs;
        consecutiveFails = 0; // half-open: uma sonda de recuperação
      }

      attempts++;
      elapsedSecs += spec.latencyMs / 1000;

      const failed = rand() < spec.failureRate;
      if (!failed) {
        outcome = "success";
        break;
      }

      consecutiveFails++;

      // Erro permanente → DLQ imediato, sem retry.
      if (!transient) {
        outcome = "dlq";
        break;
      }

      // Última tentativa esgotada → DLQ (a menos que o breaker ainda possa adiar).
      if (attempts >= policy.maxAttempts) {
        if (breaker && deferrals < breaker.maxDeferrals) {
          // Provedor ainda em outage: adia em vez de matar a tarefa.
          deferrals++;
          elapsedSecs += breaker.resetTimeoutSecs;
          attempts--; // deferral não consome a tentativa final
          consecutiveFails = 0;
          continue;
        }
        outcome = "dlq";
        break;
      }

      // Espera até a próxima tentativa (respeita Retry-After em rate_limit).
      const wait =
        spec.fault === "rate_limit" && spec.retryAfterSecs
          ? Math.max(spec.retryAfterSecs, backoffSecs(attempts, policy, rand))
          : backoffSecs(attempts, policy, rand);
      elapsedSecs += wait;
    }

    attemptsSum += attempts;
    if (outcome === "success") {
      successes++;
      resolutionTimes.push(elapsedSecs);
      if (elapsedSecs > spec.slaSecs) slaBreaches++;
    } else {
      dlq++;
    }
  }

  resolutionTimes.sort((a, b) => a - b);
  const meanResolution =
    resolutionTimes.reduce((s, v) => s + v, 0) / (resolutionTimes.length || 1);

  return {
    spec,
    trials,
    successRate: successes / trials,
    dlqRate: dlq / trials,
    slaBreachRate: slaBreaches / trials,
    meanAttempts: attemptsSum / trials,
    p95ResolutionSecs: percentile(resolutionTimes, 95),
    meanResolutionSecs: meanResolution,
  };
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
