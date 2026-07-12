import { FAULT_LABEL, type ScenarioResult } from "./simulator";

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

    // Contexto do cenário: outage total do provedor vs SLA impossível por config.
    const isOutage = r.spec.failureRate >= thresholds.outageFailureRate;
    const slaImpossible = r.spec.slaSecs < thresholds.minBackoffSecs;

    if (r.dlqRate > thresholds.maxDlqRate) {
      // Em outage, DLQ controlada (breaker segurou) é degradação esperada.
      const severity: GapSeverity = isOutage
        ? r.dlqRate > 0.5
          ? "warning"
          : "info"
        : r.dlqRate > 0.5
          ? "critical"
          : "warning";
      gaps.push({
        ...base,
        severity,
        category: isOutage ? "DLQ em outage (esperado)" : "DLQ excessiva",
        detail: isOutage
          ? `${label}: provedor em outage (falha ${(r.spec.failureRate * 100).toFixed(0)}%); ${(r.dlqRate * 100).toFixed(0)}% em dead-letter após o breaker pausar — resposta esperada é alerta/replay.`
          : `${label}: ${(r.dlqRate * 100).toFixed(0)}% das tarefas caem em dead-letter (limite ${(thresholds.maxDlqRate * 100).toFixed(0)}%).`,
      });
    }

    if (r.slaBreachRate > thresholds.maxSlaBreachRate) {
      // SLA menor que o backoff mínimo é inatingível por design, não defeito.
      const severity: GapSeverity = slaImpossible
        ? "info"
        : isOutage
          ? "warning"
          : r.slaBreachRate > 0.5
            ? "critical"
            : "warning";
      gaps.push({
        ...base,
        severity,
        category: slaImpossible
          ? "SLA inatingível por config"
          : isOutage
            ? "SLA em outage (esperado)"
            : "Violação de SLA",
        detail: slaImpossible
          ? `${label}: SLA de ${r.spec.slaSecs}s < backoff mínimo de ${thresholds.minBackoffSecs}s — inatingível por design; ajustar SLA ou base_delay.`
          : `${label}: ${(r.slaBreachRate * 100).toFixed(0)}% resolvem acima do SLA de ${r.spec.slaSecs}s (p95 ${r.p95ResolutionSecs.toFixed(0)}s).`,
      });
    }

    if (r.successRate < thresholds.minSuccessRate && r.dlqRate <= thresholds.maxDlqRate) {
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
