/**
 * Transformação pura dos registros de histórico de SLA em séries de gráfico.
 *
 * Extraída do componente para permitir teste unitário determinístico do
 * carry-forward (manter o último valor conhecido de cada fila em cada ponto).
 */

export interface SlaHistoryPoint {
  queue_kind: string;
  new_sla_seconds: number;
  created_at: string;
  /** Origem da alteração: `manual`, `recommendation` ou `seed`. */
  source?: string;
}

export interface SlaChartPoint {
  /** Rótulo do eixo X (dd/mm). */
  ts: string;
  /** ISO original — usado para desempate e tooltips. */
  iso: string;
  /** Fila alterada neste ponto (a que originou o registro). */
  changed: string;
  /** Origem da alteração que gerou este ponto. */
  source: string;
  /** Valor corrente de cada fila (carry-forward). */
  [queue: string]: string | number;
}

export interface SlaChartData {
  data: SlaChartPoint[];
  queues: string[];
}

/**
 * Ordena cronologicamente, aplica carry-forward por fila e anota a origem
 * de cada ponto para permitir destacar visualmente ajustes automáticos.
 */
export function buildSlaChartData(rows: SlaHistoryPoint[]): SlaChartData {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const queues = Array.from(new Set(sorted.map((r) => r.queue_kind)));

  const last: Record<string, number> = {};
  const data = sorted.map((r) => {
    last[r.queue_kind] = r.new_sla_seconds;
    return {
      ts: new Date(r.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      iso: r.created_at,
      changed: r.queue_kind,
      source: r.source ?? "manual",
      ...last,
    } as SlaChartPoint;
  });

  return { data, queues };
}
