import { useCallback, useState } from "react";
import {
  simulateScenario,
  DEFAULT_POLICY,
  DEFAULT_BREAKER_SIM,
  type ScenarioResult,
  type RetryPolicy,
  type BreakerSimConfig,
} from "@/lib/resilience/simulator";
import { generateScenarios, type ScenarioGridConfig } from "@/lib/resilience/scenarios";
import {
  buildGapReport,
  DEFAULT_THRESHOLDS,
  type GapReport,
  type GapThresholds,
} from "@/lib/resilience/report";

interface RunOptions {
  trials?: number;
  policy?: RetryPolicy;
  grid?: ScenarioGridConfig;
  thresholds?: GapThresholds;
}

interface SimulationState {
  running: boolean;
  progress: number;
  results: ScenarioResult[];
  report: GapReport | null;
}

const INITIAL: SimulationState = {
  running: false,
  progress: 0,
  results: [],
  report: null,
};

/**
 * Executa o simulador de resiliência de forma não-bloqueante,
 * processando os cenários em lotes para manter a UI responsiva.
 */
export function useResilienceSimulator() {
  const [state, setState] = useState<SimulationState>(INITIAL);

  const run = useCallback(async (opts: RunOptions = {}) => {
    const trials = opts.trials ?? 200;
    const policy = opts.policy ?? DEFAULT_POLICY;
    const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
    const scenarios = generateScenarios(opts.grid);

    setState({ running: true, progress: 0, results: [], report: null });

    const results: ScenarioResult[] = [];
    const batchSize = 25;

    for (let i = 0; i < scenarios.length; i += batchSize) {
      const batch = scenarios.slice(i, i + batchSize);
      for (const spec of batch) {
        results.push(simulateScenario(spec, policy, trials));
      }
      const progress = Math.round((results.length / scenarios.length) * 100);
      setState((s) => ({ ...s, progress, results: [...results] }));
      // Cede o event loop para não travar a renderização.
      await new Promise((r) => setTimeout(r, 0));
    }

    const report = buildGapReport(results, thresholds);
    setState({ running: false, progress: 100, results, report });
    return report;
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, reset };
}
