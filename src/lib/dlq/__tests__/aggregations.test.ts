import { describe, it, expect } from "vitest";
import {
  filterByPeriod,
  computePeriodStats,
  computeDailyFrequency,
  computePeriodDelta,
  sortHistory,
  type AlertHistoryPoint,
  type TrendPoint,
} from "../aggregations";

const NOW = new Date("2026-07-12T12:00:00Z").getTime();

function alert(triggered_at: string, pending_items: number, admins_notified = 1): AlertHistoryPoint {
  return { triggered_at, pending_items, admins_notified };
}

describe("filterByPeriod", () => {
  const rows = [
    alert("2026-07-12T11:00:00Z", 10), // 1h atrás
    alert("2026-07-10T12:00:00Z", 20), // 2d atrás
    alert("2026-06-30T12:00:00Z", 30), // ~12d atrás
  ];

  it("retorna tudo quando period é null", () => {
    expect(filterByPeriod(rows, null, NOW)).toHaveLength(3);
  });

  it("filtra por janela de 24h", () => {
    const out = filterByPeriod(rows, 24, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].pending_items).toBe(10);
  });

  it("filtra por janela de 7 dias", () => {
    expect(filterByPeriod(rows, 168, NOW)).toHaveLength(2);
  });

  it("inclui o limite exato da janela", () => {
    const exact = [alert(new Date(NOW - 24 * 3600_000).toISOString(), 5)];
    expect(filterByPeriod(exact, 24, NOW)).toHaveLength(1);
  });
});

describe("computePeriodStats", () => {
  it("retorna null para lista vazia", () => {
    expect(computePeriodStats([])).toBeNull();
  });

  it("calcula contagem, média, pico e notificações", () => {
    const stats = computePeriodStats([
      alert("2026-07-12T11:00:00Z", 10, 2),
      alert("2026-07-12T10:00:00Z", 30, 3),
      alert("2026-07-12T09:00:00Z", 20, 1),
    ]);
    expect(stats).toEqual({ count: 3, avg: 20, peak: 30, notified: 6 });
  });

  it("arredonda a média", () => {
    const stats = computePeriodStats([alert("a", 10), alert("b", 11)]);
    expect(stats?.avg).toBe(11); // 10.5 -> 11
  });
});

describe("computeDailyFrequency", () => {
  it("retorna vazio para lista vazia", () => {
    expect(computeDailyFrequency([])).toEqual([]);
  });

  it("agrupa por dia em ordem crescente com rótulo dd/mm", () => {
    // Usa meio-dia local para evitar ambiguidade de fuso na data.
    const out = computeDailyFrequency([
      alert("2026-07-12T12:00:00", 10),
      alert("2026-07-12T15:00:00", 20),
      alert("2026-07-10T12:00:00", 5),
    ]);
    expect(out).toEqual([
      { day: "10/07", count: 1 },
      { day: "12/07", count: 2 },
    ]);
  });
});

describe("computePeriodDelta", () => {
  const mk = (captured_at: string, pending_items: number): TrendPoint => ({ captured_at, pending_items });

  it("retorna null com menos de 2 pontos", () => {
    expect(computePeriodDelta([mk("2026-07-12T11:00:00Z", 1)], 24, NOW)).toBeNull();
  });

  it("retorna null quando falta amostra em um dos lados", () => {
    const rows = [mk("2026-07-12T11:00:00Z", 10), mk("2026-07-12T10:00:00Z", 20)];
    // Janela de 48h engloba ambos → sem período anterior.
    expect(computePeriodDelta(rows, 48, NOW)).toBeNull();
  });

  it("calcula diferença e percentual entre janelas", () => {
    const rows = [
      mk("2026-07-12T11:00:00Z", 20), // atual (janela 24h)
      mk("2026-07-11T00:00:00Z", 10), // anterior
    ];
    const delta = computePeriodDelta(rows, 24, NOW);
    expect(delta).not.toBeNull();
    expect(delta!.curAvg).toBe(20);
    expect(delta!.prevAvg).toBe(10);
    expect(delta!.diff).toBe(10);
    expect(delta!.pct).toBe(100);
  });

  it("retorna pct null quando a média anterior é zero", () => {
    const rows = [
      mk("2026-07-12T11:00:00Z", 20),
      mk("2026-07-11T00:00:00Z", 0),
    ];
    const delta = computePeriodDelta(rows, 24, NOW);
    expect(delta!.pct).toBeNull();
  });

  it("aceita pending_items como string", () => {
    const rows = [
      { captured_at: "2026-07-12T11:00:00Z", pending_items: "30" },
      { captured_at: "2026-07-11T00:00:00Z", pending_items: "10" },
    ];
    const delta = computePeriodDelta(rows, 24, NOW);
    expect(delta!.curAvg).toBe(30);
    expect(delta!.prevAvg).toBe(10);
  });
});
