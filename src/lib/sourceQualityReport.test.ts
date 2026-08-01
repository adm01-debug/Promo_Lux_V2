import { describe, it, expect } from "vitest";
import {
  totalsForSource,
  compareSources,
  queuesFromRows,
  formatPct,
  formatDelta,
  buildReportCsv,
  type SourceQualityRow,
} from "./sourceQualityReport";

const row = (over: Partial<SourceQualityRow>): SourceQualityRow => ({
  bucket_start: "2026-07-20T00:00:00Z",
  queue: "Comercial",
  source: "lusha",
  total: 10,
  with_email: 5,
  email_rate: 50,
  br_count: 4,
  br_rate: 40,
  suppressed: 1,
  suppression_rate: 20,
  ...over,
});

describe("totalsForSource", () => {
  it("soma linhas e recalcula taxas sobre os totais", () => {
    const rows = [row({}), row({ total: 30, with_email: 15, br_count: 6, suppressed: 3 })];
    const totals = totalsForSource(rows, "lusha");
    expect(totals.total).toBe(40);
    expect(totals.with_email).toBe(20);
    expect(totals.email_rate).toBe(50);
    expect(totals.br_rate).toBe(25);
    expect(totals.suppression_rate).toBe(20);
  });

  it("retorna taxas nulas sem amostra", () => {
    const totals = totalsForSource([], "apollo");
    expect(totals.total).toBe(0);
    expect(totals.email_rate).toBeNull();
    expect(totals.suppression_rate).toBeNull();
  });

  it("ignora linhas de outra fonte", () => {
    const totals = totalsForSource([row({ source: "apollo", total: 100 })], "lusha");
    expect(totals.total).toBe(0);
  });
});

describe("compareSources", () => {
  it("calcula delta em pontos percentuais", () => {
    const lusha = totalsForSource([row({})], "lusha");
    const apollo = totalsForSource(
      [row({ source: "apollo", total: 10, with_email: 8, br_count: 2, suppressed: 0 })],
      "apollo",
    );
    const delta = compareSources(lusha, apollo);
    expect(delta.email_rate).toBe(30);
    expect(delta.br_rate).toBe(-20);
    expect(delta.suppression_rate).toBe(-20);
  });

  it("propaga null quando falta base", () => {
    const delta = compareSources(totalsForSource([], "lusha"), totalsForSource([], "apollo"));
    expect(delta.email_rate).toBeNull();
  });
});

describe("queuesFromRows", () => {
  it("retorna filas únicas ordenadas", () => {
    expect(queuesFromRows([row({ queue: "TI" }), row({ queue: "Comercial" }), row({ queue: "TI" })])).toEqual([
      "Comercial",
      "TI",
    ]);
  });
});

describe("formatadores", () => {
  it("formata percentual e delta", () => {
    expect(formatPct(50)).toBe("50,0%");
    expect(formatPct(null)).toBe("—");
    expect(formatDelta(3.5)).toBe("+3,5 p.p.");
    expect(formatDelta(-3.5)).toBe("-3,5 p.p.");
    expect(formatDelta(null)).toBe("—");
  });
});

describe("buildReportCsv", () => {
  it("gera cabeçalho e linhas com separador ;", () => {
    const csv = buildReportCsv([row({})]);
    const [header, first] = csv.split("\n");
    expect(header.startsWith("periodo;fila;fonte")).toBe(true);
    expect(first).toContain("Comercial;lusha;10;5;50");
  });

  it("escapa valores com separador", () => {
    expect(buildReportCsv([row({ queue: "Vendas; Interno" })])).toContain('"Vendas; Interno"');
  });
});
