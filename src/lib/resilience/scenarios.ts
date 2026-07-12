import {
  type FaultType,
  type ScenarioSpec,
  FAULT_TRANSIENT,
} from "./simulator";

/**
 * Gera centenas de cenários combinando tipos de falha × taxa de falha ×
 * latência × SLA. Determinístico: mesma configuração → mesmos cenários.
 */

export interface ScenarioGridConfig {
  faults?: FaultType[];
  failureRates?: number[];
  latenciesMs?: number[];
  slasSecs?: number[];
}

const DEFAULT_GRID: Required<ScenarioGridConfig> = {
  faults: ["timeout", "rate_limit", "server_5xx", "client_4xx", "unavailable"],
  failureRates: [0.1, 0.25, 0.5, 0.75, 0.95],
  latenciesMs: [200, 1000, 3000, 8000],
  slasSecs: [30, 120, 600],
};

export function generateScenarios(config: ScenarioGridConfig = {}): ScenarioSpec[] {
  const grid = { ...DEFAULT_GRID, ...config };
  const scenarios: ScenarioSpec[] = [];

  for (const fault of grid.faults) {
    for (const failureRate of grid.failureRates) {
      for (const latencyMs of grid.latenciesMs) {
        for (const slaSecs of grid.slasSecs) {
          scenarios.push({
            id: `${fault}|fr${failureRate}|lat${latencyMs}|sla${slaSecs}`,
            fault,
            failureRate,
            latencyMs,
            slaSecs,
            retryAfterSecs:
              fault === "rate_limit" ? 60 : undefined,
          });
        }
      }
    }
  }

  return scenarios;
}

export function transientCount(scenarios: ScenarioSpec[]): number {
  return scenarios.filter((s) => FAULT_TRANSIENT[s.fault]).length;
}
