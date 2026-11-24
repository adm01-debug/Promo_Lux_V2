import { describe, expect, it } from "vitest";
import { declaredPhases, phaseEnabled } from "../workflow-phases.ts";

describe("declaredPhases", () => {
  it("devolve vazio para steps ausente, nulo ou nao-array", () => {
    expect(declaredPhases(undefined)).toEqual([]);
    expect(declaredPhases(null)).toEqual([]);
    expect(declaredPhases({})).toEqual([]);
    expect(declaredPhases("scrape")).toEqual([]);
  });

  it("ignora entradas sem phase ou com phase nao-string", () => {
    expect(declaredPhases([{ label: "x" }, { phase: 42 }, null, "y"])).toEqual([]);
  });

  it("coleta as fases declaradas", () => {
    expect(declaredPhases([{ phase: "scrape" }, { phase: "ipc_score" }])).toEqual([
      "scrape",
      "ipc_score",
    ]);
  });
});

describe("phaseEnabled", () => {
  it("workflow legado (steps vazio) roda todas as fases", () => {
    for (const phase of ["scrape", "enrich", "ipc_score"] as const) {
      expect(phaseEnabled([], phase)).toBe(true);
      expect(phaseEnabled(undefined, phase)).toBe(true);
      expect(phaseEnabled([{ label: "sem phase" }], phase)).toBe(true);
    }
  });

  it("steps declarados habilitam apenas as fases listadas", () => {
    const steps = [{ phase: "scrape" }, { phase: "ipc_score" }];
    expect(phaseEnabled(steps, "scrape")).toBe(true);
    expect(phaseEnabled(steps, "enrich")).toBe(false);
    expect(phaseEnabled(steps, "ipc_score")).toBe(true);
  });

  it("declarar so enrich mantem scrape e ipc_score desligados", () => {
    const steps = [{ phase: "enrich" }];
    expect(phaseEnabled(steps, "enrich")).toBe(true);
    expect(phaseEnabled(steps, "scrape")).toBe(false);
    expect(phaseEnabled(steps, "ipc_score")).toBe(false);
  });
});
