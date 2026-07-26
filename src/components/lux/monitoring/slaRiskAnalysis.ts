/**
 * Análise pura de risco de SLA.
 *
 * Um SLA padrão configurado **abaixo** do p95 observado significa que, por
 * definição, mais de 5% dos itens da fila estouram o prazo — é um alvo
 * inatingível, não uma meta ambiciosa. Isolamos a regra aqui para permitir
 * teste determinístico e reuso fora do componente.
 */

export interface SlaRiskItem {
  queue_kind: string;
  /** SLA padrão configurado, em segundos. */
  sla_seconds: number;
  /** p95 observado de enfileiramento, em segundos. */
  p95_seconds: number;
  /** Quanto o p95 excede o SLA, em % do SLA (arredondado). */
  gap_pct: number;
}

/**
 * Retorna as filas cujo p95 observado excede o SLA configurado além da
 * tolerância, ordenadas do maior para o menor desvio.
 *
 * Entradas ausentes, não-numéricas ou <= 0 são descartadas silenciosamente:
 * sem amostra confiável não há alerta a emitir (falso positivo é pior que
 * silêncio num painel operacional).
 */
export function detectSlaRisk(
  currentSla: Record<string, number | null | undefined>,
  p95ByQueue: Record<string, number | null | undefined> | undefined,
  tolerancePct = 0,
): SlaRiskItem[] {
  if (!p95ByQueue) return [];
  const out: SlaRiskItem[] = [];

  for (const [queue_kind, rawSla] of Object.entries(currentSla)) {
    const sla = Number(rawSla);
    const p95 = Number(p95ByQueue[queue_kind]);
    if (!Number.isFinite(sla) || sla <= 0) continue;
    if (!Number.isFinite(p95) || p95 <= 0) continue;

    const gap = ((p95 - sla) / sla) * 100;
    if (gap > tolerancePct) {
      out.push({
        queue_kind,
        sla_seconds: sla,
        p95_seconds: p95,
        gap_pct: Math.round(gap),
      });
    }
  }

  return out.sort((a, b) => b.gap_pct - a.gap_pct);
}
