import { describe, it, expect } from "vitest";
import { detectSlaRisk } from "../slaRiskAnalysis";

describe("detectSlaRisk", () => {
  it("sinaliza fila cujo p95 excede o SLA configurado", () => {
    const risk = detectSlaRisk({ web: 300 }, { web: 450 });
    expect(risk).toEqual([
      { queue_kind: "web", sla_seconds: 300, p95_seconds: 450, gap_pct: 50 },
    ]);
  });

  it("não sinaliza quando o p95 está dentro do SLA", () => {
    expect(detectSlaRisk({ web: 600 }, { web: 300 })).toEqual([]);
  });

  it("respeita a tolerância percentual", () => {
    expect(detectSlaRisk({ web: 100 }, { web: 105 }, 10)).toEqual([]);
    expect(detectSlaRisk({ web: 100 }, { web: 130 }, 10)).toHaveLength(1);
  });

  it("descarta valores ausentes, zerados ou não-numéricos", () => {
    const risk = detectSlaRisk(
      { web: 0, scrape: null, instagram: 300, legado: 100 },
      { web: 900, scrape: 900, instagram: Number.NaN, legado: undefined },
    );
    expect(risk).toEqual([]);
  });

  it("ordena do maior para o menor desvio", () => {
    const risk = detectSlaRisk(
      { web: 100, scrape: 100, instagram: 100 },
      { web: 150, scrape: 400, instagram: 200 },
    );
    expect(risk.map((r) => r.queue_kind)).toEqual(["scrape", "instagram", "web"]);
  });

  it("retorna vazio sem dados de p95", () => {
    expect(detectSlaRisk({ web: 300 }, undefined)).toEqual([]);
  });
});
