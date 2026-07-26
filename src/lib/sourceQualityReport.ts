/**
 * Utilitários puros do relatório comparativo Lusha × Apollo.
 *
 * O RPC `source_quality_report` devolve uma linha por (período, fila, fonte).
 * Aqui ficam apenas transformações determinísticas — nada de I/O — para que
 * possam ser testadas isoladamente.
 */

/** Fontes de contato suportadas no relatório. */
export type ContactSource = "lusha" | "apollo" | string;

/** Linha bruta retornada pelo RPC `source_quality_report`. */
export interface SourceQualityRow {
  bucket_start: string;
  queue: string;
  source: ContactSource;
  total: number;
  with_email: number;
  email_rate: number | null;
  br_count: number;
  br_rate: number | null;
  suppressed: number;
  suppression_rate: number | null;
}

/** Agregado consolidado de uma fonte (todas as filas/períodos do filtro). */
export interface SourceTotals {
  source: ContactSource;
  total: number;
  with_email: number;
  br_count: number;
  suppressed: number;
  email_rate: number | null;
  br_rate: number | null;
  suppression_rate: number | null;
}

/** Diferença percentual (em pontos) entre Apollo e Lusha. */
export interface SourceDelta {
  email_rate: number | null;
  br_rate: number | null;
  suppression_rate: number | null;
}

const rate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null;

/** Soma as linhas de uma fonte, recalculando as taxas sobre os totais. */
export function totalsForSource(
  rows: readonly SourceQualityRow[],
  source: ContactSource,
): SourceTotals {
  const scoped = rows.filter((row) => row.source === source);
  const total = scoped.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const withEmail = scoped.reduce((sum, row) => sum + (row.with_email ?? 0), 0);
  const brCount = scoped.reduce((sum, row) => sum + (row.br_count ?? 0), 0);
  const suppressed = scoped.reduce((sum, row) => sum + (row.suppressed ?? 0), 0);

  return {
    source,
    total,
    with_email: withEmail,
    br_count: brCount,
    suppressed,
    email_rate: rate(withEmail, total),
    br_rate: rate(brCount, total),
    // Supressão é medida sobre a base de e-mails obtidos, não sobre o total.
    suppression_rate: rate(suppressed, withEmail),
  };
}

/**
 * Delta em pontos percentuais de Apollo em relação a Lusha.
 * Retorna `null` no campo quando falta base de comparação.
 */
export function compareSources(lusha: SourceTotals, apollo: SourceTotals): SourceDelta {
  const diff = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : Math.round((a - b) * 100) / 100;

  return {
    email_rate: diff(apollo.email_rate, lusha.email_rate),
    br_rate: diff(apollo.br_rate, lusha.br_rate),
    suppression_rate: diff(apollo.suppression_rate, lusha.suppression_rate),
  };
}

/** Lista ordenada e única das filas presentes no resultado. */
export function queuesFromRows(rows: readonly SourceQualityRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.queue))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

/** Formata percentual para exibição em PT-BR; `—` quando indefinido. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Formata o delta com sinal explícito. */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
}

const CSV_HEADERS = [
  "periodo",
  "fila",
  "fonte",
  "contatos",
  "com_email",
  "taxa_email_pct",
  "contatos_br",
  "cobertura_br_pct",
  "suprimidos",
  "taxa_supressao_pct",
] as const;

const csvCell = (value: string | number | null): string => {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",;\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

/** Serializa as linhas do relatório em CSV (separador `;`, padrão PT-BR). */
export function buildReportCsv(rows: readonly SourceQualityRow[]): string {
  const lines = [CSV_HEADERS.join(";")];
  for (const row of rows) {
    lines.push(
      [
        row.bucket_start,
        row.queue,
        row.source,
        row.total,
        row.with_email,
        row.email_rate,
        row.br_count,
        row.br_rate,
        row.suppressed,
        row.suppression_rate,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return lines.join("\n");
}
