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

/** Ponto de tendência já normalizado usado pelo gráfico (label + timestamp). */
export interface TrendChartPoint {
  /** Rótulo do eixo X (ex.: "14:30"). */
  t: string;
  /** Timestamp (ms) usado para achar o ponto mais próximo. */
  ts: number;
  pending: number;
}

/** Registro de alerta com os campos necessários para marcar o gráfico. */
export interface AlertDotSource {
  id: string;
  triggered_at: string;
  pending_items: number;
  pending_critical: number;
  consecutive: number;
  admins_notified: number;
}

/** Marcador de alerta posicionado sobre o ponto de tendência mais próximo. */
export interface AlertDot extends AlertDotSource {
  /** Rótulo do eixo X do ponto de tendência mais próximo. */
  x: string;
  /** Valor de pendências do ponto mais próximo (posição vertical do dot). */
  y: number;
}

/**
 * Para cada alerta dentro da janela `[nowMs - rangeHours, nowMs]`, encontra o
 * ponto de tendência temporalmente mais próximo e o converte em um marcador
 * (`AlertDot`) posicionável no gráfico. Função pura: `nowMs` é injetado.
 *
 * Retorna lista vazia se não houver pontos de tendência (nada onde ancorar).
 */
export function computeAlertDots(
  alerts: AlertDotSource[],
  trendData: TrendChartPoint[],
  rangeHours: number,
  nowMs: number,
): AlertDot[] {
  if (trendData.length === 0) return [];
  const rangeStart = nowMs - rangeHours * 3600_000;
  return alerts
    .filter((a) => new Date(a.triggered_at).getTime() >= rangeStart)
    .map((a) => {
      const at = new Date(a.triggered_at).getTime();
      const nearest = trendData.reduce((best, cur) =>
        Math.abs(cur.ts - at) < Math.abs(best.ts - at) ? cur : best,
      );
      return {
        ...a,
        x: nearest.t,
        y: nearest.pending,
      };
    });
}


/**
 * Pico estatisticamente relevante identificado na série de tendência.
 *
 * `zScore` é o afastamento (em desvios-padrão) do valor em relação à média da
 * janela; usamos isso — em vez de um limite absoluto — para que a detecção se
 * adapte à magnitude natural de cada organização.
 */
export interface SpikePoint {
  t: string;
  ts: number;
  pending: number;
  /** Afastamento da média em desvios-padrão (>= 0). */
  zScore: number;
}

export interface SpikeDetectionOptions {
  /** zScore mínimo para um ponto ser considerado pico. Default 1.5. */
  minZ?: number;
  /** Pendências mínimas absolutas para evitar ruído em séries baixas. Default 1. */
  minPending?: number;
}

/**
 * Detecta picos numa série de tendência via z-score sobre média/desvio da
 * própria janela. Função pura e determinística. Retorna picos em ordem
 * cronológica crescente. Séries com menos de 3 pontos ou desvio-padrão nulo
 * (valores constantes) não produzem picos.
 */
export function detectSpikes(
  trendData: TrendChartPoint[],
  opts: SpikeDetectionOptions = {},
): SpikePoint[] {
  const minZ = opts.minZ ?? 1.5;
  const minPending = opts.minPending ?? 1;
  if (trendData.length < 3) return [];

  const values = trendData.map((p) => p.pending);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return [];

  return trendData
    .map((p) => ({ ...p, zScore: (p.pending - mean) / std }))
    .filter((p) => p.zScore >= minZ && p.pending >= minPending)
    .map((p) => ({ t: p.t, ts: p.ts, pending: p.pending, zScore: p.zScore }));
}

/** Registro de log mínimo necessário para correlação temporal. */
export interface CorrelatableLog {
  id: string;
  created_at: string;
  level: "info" | "warn" | "error";
  message: string | null;
  failure_reason: string | null;
}

/** Um pico com os logs de automação temporalmente próximos a ele. */
export interface SpikeCorrelation<L extends CorrelatableLog = CorrelatableLog> {
  spike: SpikePoint;
  logs: L[];
  errorCount: number;
  warnCount: number;
}

export interface CorrelationOptions {
  /**
   * Janela (ms) em torno do timestamp do pico onde os logs são considerados
   * relacionados. Default: 30 min. A janela é simétrica (antes e depois),
   * pois um pico pode ser tanto causa (erro anterior) quanto efeito.
   */
  windowMs?: number;
  minZ?: number;
  minPending?: number;
}

/**
 * Correlaciona picos da tendência com logs de automação que ocorreram dentro
 * de uma janela temporal ao redor de cada pico. Função pura: não lê relógio
 * nem estado global. Logs são ordenados por proximidade ao pico e apenas picos
 * com ao menos um log associado são retornados (ordem cronológica do pico).
 */
export function correlateSpikesWithLogs<L extends CorrelatableLog>(
  trendData: TrendChartPoint[],
  logs: L[],
  opts: CorrelationOptions = {},
): SpikeCorrelation<L>[] {
  const windowMs = opts.windowMs ?? 30 * 60_000;
  const spikes = detectSpikes(trendData, { minZ: opts.minZ, minPending: opts.minPending });
  if (spikes.length === 0) return [];

  // Pré-computa timestamps dos logs uma única vez (evita reparse por pico).
  const stamped = logs.map((l) => ({ log: l, ts: new Date(l.created_at).getTime() }));

  const out: SpikeCorrelation<L>[] = [];
  for (const spike of spikes) {
    const related = stamped
      .filter(({ ts }) => Math.abs(ts - spike.ts) <= windowMs)
      .sort((a, b) => Math.abs(a.ts - spike.ts) - Math.abs(b.ts - spike.ts))
      .map(({ log }) => log);
    if (related.length === 0) continue;
    out.push({
      spike,
      logs: related,
      errorCount: related.filter((l) => l.level === "error").length,
      warnCount: related.filter((l) => l.level === "warn").length,
    });
  }
  return out;
}
