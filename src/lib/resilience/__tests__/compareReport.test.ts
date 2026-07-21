import { describe, it, expect } from "vitest";
import { buildComparison, type SnapshotFile } from "../compareReport";

const mk = (rows: Array<[string, number, number, number]>): SnapshotFile => ({
  summary: {
    total_scenarios: rows.length,
    avg_success_rate: rows.reduce((a, r) => a + r[1], 0) / (rows.length || 1),
    avg_dlq_rate: rows.reduce((a, r) => a + r[2], 0) / (rows.length || 1),
  },
  perScenario: rows.map(([id, s, d, p]) => ({ id, successRate: s, dlqRate: d, p95: p })),
});

describe("buildComparison", () => {
  it("classifies improvement, regression and stability", () => {
    const baseline = mk([["a", 0.5, 0.5, 100], ["b", 0.9, 0.1, 50], ["c", 0.8, 0.2, 40]]);
    const current  = mk([["a", 0.6, 0.4, 100], ["b", 0.7, 0.3, 60], ["c", 0.81, 0.19, 40]]);
    const r = buildComparison(baseline, current);
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.classification]));
    expect(byId.a).toBe("improved");
    expect(byId.b).toBe("regressed");
    expect(byId.c).toBe("stable");
  });

  it("marks new and removed scenarios", () => {
    const baseline = mk([["a", 0.5, 0.5, 10]]);
    const current  = mk([["b", 0.5, 0.5, 10]]);
    const r = buildComparison(baseline, current);
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.classification]));
    expect(byId.a).toBe("removed");
    expect(byId.b).toBe("new");
  });

  it("computes aggregate deltas and top lists", () => {
    const baseline = mk([["a", 0.5, 0.5, 100], ["b", 0.5, 0.5, 100]]);
    const current  = mk([["a", 0.8, 0.2, 60],  ["b", 0.3, 0.7, 200]]);
    const r = buildComparison(baseline, current);
    expect(r.aggregate.deltaAvgSuccess).toBeCloseTo(0.05);
    expect(r.aggregate.counts.improved).toBe(1);
    expect(r.aggregate.counts.regressed).toBe(1);
    expect(r.topImprovements[0].id).toBe("a");
    expect(r.topRegressions[0].id).toBe("b");
  });

  it("classifies as improved when p95 drops ≥5% even without success delta", () => {
    const baseline = mk([["a", 0.9, 0.1, 100]]);
    const current  = mk([["a", 0.9, 0.1, 90]]);
    const r = buildComparison(baseline, current);
    expect(r.rows[0].classification).toBe("improved");
  });
});
