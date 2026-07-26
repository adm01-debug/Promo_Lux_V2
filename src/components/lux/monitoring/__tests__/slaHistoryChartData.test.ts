import { describe, it, expect } from "vitest";
import { buildSlaChartData } from "../slaHistoryChartData";

const iso = (d: string) => new Date(d).toISOString();

describe("buildSlaChartData", () => {
  it("retorna vazio para entrada vazia", () => {
    expect(buildSlaChartData([])).toEqual({ data: [], queues: [] });
  });

  it("ordena cronologicamente mesmo com entrada fora de ordem", () => {
    const { data } = buildSlaChartData([
      { queue_kind: "web", new_sla_seconds: 200, created_at: iso("2026-07-10T10:00:00Z") },
      { queue_kind: "web", new_sla_seconds: 100, created_at: iso("2026-07-01T10:00:00Z") },
    ]);
    expect(data.map((p) => p.web)).toEqual([100, 200]);
  });

  it("aplica carry-forward: fila não alterada mantém o último valor", () => {
    const { data, queues } = buildSlaChartData([
      { queue_kind: "web", new_sla_seconds: 100, created_at: iso("2026-07-01T10:00:00Z") },
      { queue_kind: "instagram", new_sla_seconds: 500, created_at: iso("2026-07-02T10:00:00Z") },
      { queue_kind: "web", new_sla_seconds: 150, created_at: iso("2026-07-03T10:00:00Z") },
    ]);
    expect(queues).toEqual(["web", "instagram"]);
    expect(data[1].web).toBe(100); // carry-forward
    expect(data[2].instagram).toBe(500); // carry-forward
    expect(data[2].web).toBe(150);
  });

  it("não inventa valor para fila ainda não vista", () => {
    const { data } = buildSlaChartData([
      { queue_kind: "web", new_sla_seconds: 100, created_at: iso("2026-07-01T10:00:00Z") },
      { queue_kind: "instagram", new_sla_seconds: 500, created_at: iso("2026-07-02T10:00:00Z") },
    ]);
    expect(data[0].instagram).toBeUndefined();
  });

  it("anota fila alterada e origem, com fallback para manual", () => {
    const { data } = buildSlaChartData([
      {
        queue_kind: "web",
        new_sla_seconds: 100,
        created_at: iso("2026-07-01T10:00:00Z"),
        source: "recommendation",
      },
      { queue_kind: "web", new_sla_seconds: 120, created_at: iso("2026-07-02T10:00:00Z") },
    ]);
    expect(data[0].source).toBe("recommendation");
    expect(data[0].changed).toBe("web");
    expect(data[1].source).toBe("manual");
  });
});
