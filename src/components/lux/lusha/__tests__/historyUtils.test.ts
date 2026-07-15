import { describe, it, expect } from "vitest";
import {
  filterHistory,
  formatDurationMs,
  normalizeDomain,
  findRecentDuplicate,
  buildHistoryCsvRows,
  type DMHistoryEntry,
} from "../historyUtils";

const mk = (over: Partial<DMHistoryEntry> = {}): DMHistoryEntry => ({
  id: over.id ?? "1",
  domain: over.domain ?? "acme.com",
  linkedin: over.linkedin ?? null,
  startedAt: over.startedAt ?? "2026-07-15T10:00:00.000Z",
  finishedAt: over.finishedAt ?? "2026-07-15T10:00:05.000Z",
  status: over.status ?? "done",
  total: over.total ?? 3,
  message: over.message,
  durationMs: over.durationMs ?? 5000,
});

describe("filterHistory", () => {
  const entries = [
    mk({ id: "a", domain: "acme.com", status: "done", total: 5 }),
    mk({ id: "b", domain: "beta.io", status: "failed", total: 0, linkedin: "linkedin.com/company/beta" }),
    mk({ id: "c", domain: "acme.com", status: "cancelled", total: 0, finishedAt: "2026-06-01T00:00:00.000Z" }),
  ];

  it("busca por domínio e por linkedin (case-insensitive)", () => {
    expect(filterHistory(entries, { q: "ACME", status: "all", from: "", to: "" })).toHaveLength(2);
    expect(filterHistory(entries, { q: "beta", status: "all", from: "", to: "" })).toHaveLength(1);
    expect(filterHistory(entries, { q: "company/beta", status: "all", from: "", to: "" })).toHaveLength(1);
  });

  it("filtra por status", () => {
    expect(filterHistory(entries, { q: "", status: "failed", from: "", to: "" }).map((e) => e.id)).toEqual(["b"]);
  });

  it("aplica janela de datas inclusiva", () => {
    const res = filterHistory(entries, { q: "", status: "all", from: "2026-07-01", to: "2026-07-31" });
    expect(res.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("descarta datas inválidas", () => {
    const bad = [...entries, mk({ id: "x", finishedAt: "not-a-date" })];
    const res = filterHistory(bad, { q: "", status: "all", from: "", to: "" });
    expect(res.find((e) => e.id === "x")).toBeUndefined();
  });
});

describe("formatDurationMs", () => {
  it("cobre nulo, negativo e infinito", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(-5)).toBe("—");
    expect(formatDurationMs(Number.POSITIVE_INFINITY)).toBe("—");
  });
  it("formata por faixas", () => {
    expect(formatDurationMs(250)).toBe("250ms");
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(65_000)).toBe("1m 5s");
  });
});

describe("normalizeDomain", () => {
  it("remove protocolo, www e path", () => {
    expect(normalizeDomain("  HTTPS://WWW.Acme.com/careers ")).toBe("acme.com");
    expect(normalizeDomain("http://beta.io")).toBe("beta.io");
    expect(normalizeDomain("")).toBe("");
  });
});

describe("findRecentDuplicate", () => {
  const now = new Date("2026-07-15T12:00:00.000Z").getTime();
  const entries = [
    mk({ id: "recent", domain: "acme.com", status: "done", finishedAt: "2026-07-15T09:00:00.000Z" }),
    mk({ id: "old", domain: "acme.com", status: "done", finishedAt: "2026-07-10T09:00:00.000Z" }),
    mk({ id: "processing", domain: "beta.io", status: "processing", finishedAt: "2026-07-15T11:00:00.000Z" }),
  ];

  it("encontra duplicata dentro de 24h", () => {
    expect(findRecentDuplicate(entries, "https://www.acme.com/", now)?.id).toBe("recent");
  });
  it("ignora entradas em andamento", () => {
    expect(findRecentDuplicate(entries, "beta.io", now)).toBeNull();
  });
  it("ignora fora da janela", () => {
    expect(findRecentDuplicate([entries[1]], "acme.com", now)).toBeNull();
  });
  it("retorna null para input vazio", () => {
    expect(findRecentDuplicate(entries, "   ", now)).toBeNull();
  });
});

describe("buildHistoryCsvRows", () => {
  it("mapeia colunas e traduz status", () => {
    const rows = buildHistoryCsvRows([mk({ status: "failed", message: "boom" })]);
    expect(rows[0]["Status"]).toBe("Falhou");
    expect(rows[0]["Mensagem"]).toBe("boom");
    expect(rows[0]["Domínio"]).toBe("acme.com");
  });
  it("normaliza campos ausentes", () => {
    const rows = buildHistoryCsvRows([mk({ linkedin: null, message: null, durationMs: null })]);
    expect(rows[0]["LinkedIn"]).toBe("");
    expect(rows[0]["Mensagem"]).toBe("");
    expect(rows[0]["Duração"]).toBe("—");
    expect(rows[0]["Duração (ms)"]).toBe("");
  });
});
