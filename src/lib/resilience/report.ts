import { FAULT_LABEL, FAULT_TRANSIENT, type ScenarioResult } from "./simulator";

/**
 * Analisa os resultados da simulação e produz um relatório de gaps —
 * pontos onde o sistema falharia de forma inaceitável em produção.
 */

export type GapSeverity = "critical" | "warning" | "info";

export interface GapThresholds {
  maxDlqRate: number;
  maxSlaBreachRate: number;
  minSuccessRate: number;
  /**
   * Acima desta taxa de falha o provedor é considerado em OUTAGE total.
   * Nesses cenários a resposta correta é o circuit breaker pausar o
   * despacho e alertar — não é um defeito da fila, então classificamos
   * como degradação esperada (info), desde que a DLQ não exploda.
   */
  outageFailureRate: number;
  /**
   * Menor backoff da política (s). Se o SLA for menor que isto, uma única
   * retentativa já o estoura — é limitação de configuração, não defeito.
   */
  minBackoffSecs: number;
}

export const DEFAULT_THRESHOLDS: GapThresholds = {
  maxDlqRate: 0.1,
  maxSlaBreachRate: 0.2,
  minSuccessRate: 0.9,
  outageFailureRate: 0.95,
  minBackoffSecs: 30,
};

export interface Gap {
  scenarioId: string;
  severity: GapSeverity;
  category: string;
  detail: string;
  metrics: {
    successRate: number;
    dlqRate: number;
    slaBreachRate: number;
    p95ResolutionSecs: number;
  };
}

export interface GapReport {
  totalScenarios: number;
  totalTrials: number;
  passing: number;
  gaps: Gap[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    worstDlqRate: number;
    worstSlaBreachRate: number;
    avgSuccessRate: number;
  };
  generatedAt: string;
}

export function buildGapReport(
  results: ScenarioResult[],
  thresholds: GapThresholds = DEFAULT_THRESHOLDS,
): GapReport {
  const gaps: Gap[] = [];
  let worstDlq = 0;
  let worstSla = 0;
  let successSum = 0;

  for (const r of results) {
    worstDlq = Math.max(worstDlq, r.dlqRate);
    worstSla = Math.max(worstSla, r.slaBreachRate);
    successSum += r.successRate;

    const label = FAULT_LABEL[r.spec.fault];
    const base = {
      scenarioId: r.spec.id,
      metrics: {
        successRate: r.successRate,
        dlqRate: r.dlqRate,
        slaBreachRate: r.slaBreachRate,
        p95ResolutionSecs: r.p95ResolutionSecs,
      },
    };

    // Contexto do cenário.
    const isOutage = r.spec.failureRate >= thresholds.outageFailureRate;
    const slaImpossible = r.spec.slaSecs < thresholds.minBackoffSecs;
    const isPermanent = !FAULT_TRANSIENT[r.spec.fault];

    if (r.dlqRate > thresholds.maxDlqRate) {
      // DLQ de erro permanente (4xx) é o comportamento CORRETO — não retentar.
      // DLQ em outage controlada pelo breaker é degradação esperada.
      // Só é crítico quando trabalho RECUPERÁVEL é perdido em massa.
      let severity: GapSeverity;
      let category: string;
      let detail: string;
      if (isPermanent) {
        severity = "info";
        category = "DLQ por erro permanente (esperado)";
        detail = `${label}: erro não-retentável vai direto para dead-letter (${(r.dlqRate * 100).toFixed(0)}%) — comportamento correto; foco em corrigir a origem do 4xx.`;
      } else if (isOutage) {
        severity = r.dlqRate > 0.5 ? "warning" : "info";
        category = "DLQ em outage (esperado)";
        detail = `${label}: provedor em outage (falha ${(r.spec.failureRate * 100).toFixed(0)}%); ${(r.dlqRate * 100).toFixed(0)}% em dead-letter após o breaker pausar — resposta esperada é alerta/replay.`;
      } else {
        severity = r.dlqRate > 0.5 ? "critical" : "warning";
        category = "DLQ excessiva";
        detail = `${label}: ${(r.dlqRate * 100).toFixed(0)}% de trabalho recuperável perdido em dead-letter (limite ${(thresholds.maxDlqRate * 100).toFixed(0)}%).`;
      }
      gaps.push({ ...base, severity, category, detail });
    }

    if (r.slaBreachRate > thresholds.maxSlaBreachRate) {
      // SLA breach NÃO é perda de dado — a tarefa completa, só demora.
      // Nunca é crítico; no máximo warning. SLA < backoff mínimo é config.
      const severity: GapSeverity = slaImpossible ? "info" : "warning";
      gaps.push({
        ...base,
        severity,
        category: slaImpossible
          ? "SLA inatingível por config"
          : isOutage
            ? "SLA em outage (esperado)"
            : "Latência acima do SLA",
        detail: slaImpossible
          ? `${label}: SLA de ${r.spec.slaSecs}s < backoff mínimo de ${thresholds.minBackoffSecs}s — inatingível por design; ajustar SLA ou base_delay.`
          : `${label}: ${(r.slaBreachRate * 100).toFixed(0)}% resolvem acima do SLA de ${r.spec.slaSecs}s (p95 ${r.p95ResolutionSecs.toFixed(0)}s) — tarefa completa, porém lenta.`,
      });
    }

    if (r.successRate < thresholds.minSuccessRate && r.dlqRate <= thresholds.maxDlqRate && !isPermanent) {
      gaps.push({
        ...base,
        severity: "info",
        category: "Baixa taxa de sucesso",
        detail: `${label}: taxa de sucesso ${(r.successRate * 100).toFixed(0)}% abaixo do alvo de ${(thresholds.minSuccessRate * 100).toFixed(0)}%.`,
      });
    }
  }

  const critical = gaps.filter((g) => g.severity === "critical").length;
  const warning = gaps.filter((g) => g.severity === "warning").length;
  const info = gaps.filter((g) => g.severity === "info").length;

  // Cenários sem nenhum gap.
  const scenariosWithGap = new Set(gaps.map((g) => g.scenarioId));

  return {
    totalScenarios: results.length,
    totalTrials: results.reduce((s, r) => s + r.trials, 0),
    passing: results.length - scenariosWithGap.size,
    gaps: gaps.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    summary: {
      critical,
      warning,
      info,
      worstDlqRate: worstDlq,
      worstSlaBreachRate: worstSla,
      avgSuccessRate: successSum / (results.length || 1),
    },
    generatedAt: new Date().toISOString(),
  };
}

function severityRank(s: GapSeverity): number {
  return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}
