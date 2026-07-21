/**
 * Compara dois snapshots de simulação (baseline vs. atual) e produz um
 * relatório com deltas por cenário e agregados. Puramente client-side.
 */

export interface SnapshotRow {
  id: string;
  successRate: number;
  dlqRate: number;
  p95: number;
  meanAttempts?: number;
  slaBreachRate?: number;
}

export interface SnapshotFile {
  summary: {
    total_scenarios: number;
    avg_success_rate: number;
    avg_dlq_rate: number;
    avg_sla_breach_rate?: number;
    avg_attempts?: number;
  };
  perScenario: SnapshotRow[];
  label?: string;
  policy?: unknown;
}

export type Classification = "improved" | "regressed" | "stable" | "new" | "removed";

export interface ComparisonRow {
  id: string;
  baseline: SnapshotRow | null;
  current: SnapshotRow | null;
  deltaSuccessRate: number; // current - baseline (positivo = melhor)
  deltaP95: number;          // current - baseline (positivo = pior)
  deltaDlqRate: number;      // current - baseline (positivo = pior)
  classification: Classification;
}

export interface ComparisonReport {
  baselineLabel: string;
  currentLabel: string;
  aggregate: {
    baselineAvgSuccess: number;
    currentAvgSuccess: number;
    deltaAvgSuccess: number;
    baselineAvgDlq: number;
    currentAvgDlq: number;
    deltaAvgDlq: number;
    baselineAvgP95: number;
    currentAvgP95: number;
    deltaAvgP95: number;
    counts: Record<Classification, number>;
  };
  rows: ComparisonRow[];
  topImprovements: ComparisonRow[];
  topRegressions: ComparisonRow[];
}

/** +2pp em success OU −5% em p95 ⇒ improved; inverso ⇒ regressed. */
export const IMPROVE_SUCCESS_DELTA = 0.02;
export const IMPROVE_P95_PCT = 0.05;

function classifyRow(row: Omit<ComparisonRow, "classification">): Classification {
  if (!row.baseline) return "new";
  if (!row.current) return "removed";
  const p95Base = row.baseline.p95 || 0;
  const p95Pct = p95Base > 0 ? row.deltaP95 / p95Base : 0;
  const improved =
    row.deltaSuccessRate >= IMPROVE_SUCCESS_DELTA || p95Pct <= -IMPROVE_P95_PCT;
  const regressed =
    row.deltaSuccessRate <= -IMPROVE_SUCCESS_DELTA || p95Pct >= IMPROVE_P95_PCT;
  if (improved && !regressed) return "improved";
  if (regressed && !improved) return "regressed";
  return "stable";
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildComparison(
  baseline: SnapshotFile,
  current: SnapshotFile,
): ComparisonReport {
  const bMap = new Map(baseline.perScenario.map((r) => [r.id, r]));
  const cMap = new Map(current.perScenario.map((r) => [r.id, r]));
  const ids = new Set<string>([...bMap.keys(), ...cMap.keys()]);

  const rows: ComparisonRow[] = [];
  for (const id of ids) {
    const b = bMap.get(id) ?? null;
    const c = cMap.get(id) ?? null;
    const deltaSuccessRate = (c?.successRate ?? 0) - (b?.successRate ?? 0);
    const deltaP95 = (c?.p95 ?? 0) - (b?.p95 ?? 0);
    const deltaDlqRate = (c?.dlqRate ?? 0) - (b?.dlqRate ?? 0);
    const partial = { id, baseline: b, current: c, deltaSuccessRate, deltaP95, deltaDlqRate };
    rows.push({ ...partial, classification: classifyRow(partial) });
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));

  const counts: Record<Classification, number> = {
    improved: 0, regressed: 0, stable: 0, new: 0, removed: 0,
  };
  rows.forEach((r) => { counts[r.classification]++; });

  const commonRows = rows.filter((r) => r.baseline && r.current);
  const topImprovements = [...commonRows]
    .sort((a, b) => b.deltaSuccessRate - a.deltaSuccessRate)
    .slice(0, 5);
  const topRegressions = [...commonRows]
    .sort((a, b) => a.deltaSuccessRate - b.deltaSuccessRate)
    .slice(0, 5);

  const baselineAvgP95 = avg(baseline.perScenario.map((r) => r.p95));
  const currentAvgP95 = avg(current.perScenario.map((r) => r.p95));

  return {
    baselineLabel: baseline.label ?? "baseline",
    currentLabel: current.label ?? "atual",
    aggregate: {
      baselineAvgSuccess: baseline.summary.avg_success_rate,
      currentAvgSuccess: current.summary.avg_success_rate,
      deltaAvgSuccess: current.summary.avg_success_rate - baseline.summary.avg_success_rate,
      baselineAvgDlq: baseline.summary.avg_dlq_rate,
      currentAvgDlq: current.summary.avg_dlq_rate,
      deltaAvgDlq: current.summary.avg_dlq_rate - baseline.summary.avg_dlq_rate,
      baselineAvgP95,
      currentAvgP95,
      deltaAvgP95: currentAvgP95 - baselineAvgP95,
      counts,
    },
    rows,
    topImprovements,
    topRegressions,
  };
}
