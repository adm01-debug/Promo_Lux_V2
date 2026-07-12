/**
 * Agregações puras do domínio de monitoramento da Dead-Letter Queue.
 *
 * Extraídas dos componentes de UI para permitir teste unitário isolado e
 * reuso. Todas as funções são puras: não leem relógio, DOM nem estado global —
 * qualquer dependência temporal é injetada via parâmetro (`nowMs`).
 */

/** Item mínimo do histórico de alertas necessário para as agregações. */
export interface AlertHistoryPoint {
  triggered_at: string;
  pending_items: number;
  admins_notified: number;
}

/** Ponto mínimo de tendência necessário para o comparativo período-a-período. */
export interface TrendPoint {
  captured_at: string;
  pending_items: number | string;
}

/**
 * Filtra pontos do histórico dentro de uma janela de `periodHours` a partir de
 * `nowMs`. `periodHours = null` retorna todos os itens (sem filtro).
 */
export function filterByPeriod<T extends { triggered_at: string }>(
  rows: T[],
  periodHours: number | null,
  nowMs: number,
): T[] {
  if (periodHours === null) return rows;
  const cutoff = nowMs - periodHours * 3600_000;
  return rows.filter((h) => new Date(h.triggered_at).getTime() >= cutoff);
}

export interface PeriodStats {
  count: number;
  avg: number;
  peak: number;
  notified: number;
}

/** Resumo estatístico (contagem, média, pico, notificações) do histórico. */
export function computePeriodStats(rows: AlertHistoryPoint[]): PeriodStats | null {
  if (rows.length === 0) return null;
  const pendings = rows.map((h) => h.pending_items);
  const total = pendings.reduce((a, b) => a + b, 0);
  const notified = rows.reduce((a, h) => a + h.admins_notified, 0);
  return {
    count: rows.length,
    avg: Math.round(total / rows.length),
    peak: Math.max(...pendings),
    notified,
  };
}

export interface DailyFrequencyPoint {
  day: string;
  count: number;
}

/**
 * Agrupa disparos por dia (fuso local), em ordem cronológica crescente.
 * O rótulo `day` sai no formato `dd/mm`.
 */
export function computeDailyFrequency(rows: AlertHistoryPoint[]): DailyFrequencyPoint[] {
  if (rows.length === 0) return [];
  const byDay = new Map<string, number>();
  for (const h of rows) {
    const d = new Date(h.triggered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [, mm, dd] = key.split("-");
      return { day: `${dd}/${mm}`, count };
    });
}

/** Chave de ordenação disponível para o histórico de alertas. */
export type SortKey = "date" | "volume";
/** Direção de ordenação. */
export type SortDir = "asc" | "desc";

/**
 * Ordena o histórico de alertas por data de disparo ou por volume de itens
 * pendentes. Retorna uma nova lista (não muta a entrada). Empates em `volume`
 * são desempatados pela data mais recente para manter estabilidade previsível.
 */
export function sortHistory<T extends { triggered_at: string; pending_items: number }>(
  rows: T[],
  key: SortKey,
  dir: SortDir,
): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "volume" && a.pending_items !== b.pending_items) {
      return (a.pending_items - b.pending_items) * factor;
    }
    const ta = new Date(a.triggered_at).getTime();
    const tb = new Date(b.triggered_at).getTime();
    return (ta - tb) * factor;
  });
}

export interface PeriodDelta {
  curAvg: number;
  prevAvg: number;
  diff: number;
  pct: number | null;
}

/**
 * Compara a média de pendências da janela atual (`rangeHours` a partir de
 * `nowMs`) com a janela imediatamente anterior de mesma duração. Retorna null
 * quando não há amostras suficientes nos dois lados.
 */
export function computePeriodDelta(
  rows: TrendPoint[],
  rangeHours: number,
  nowMs: number,
): PeriodDelta | null {
  if (rows.length < 2) return null;
  const cutoff = nowMs - rangeHours * 3600_000;
  const cur: number[] = [];
  const prev: number[] = [];
  for (const p of rows) {
    const val = Number(p.pending_items);
    if (new Date(p.captured_at).getTime() >= cutoff) cur.push(val);
    else prev.push(val);
  }
  if (cur.length === 0 || prev.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const curAvg = avg(cur);
  const prevAvg = avg(prev);
  const diff = curAvg - prevAvg;
  const pct = prevAvg > 0 ? (diff / prevAvg) * 100 : null;
  return { curAvg, prevAvg, diff, pct };
}
