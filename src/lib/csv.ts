/**
 * Utilitário de exportação CSV compatível com Excel/PT-BR (BOM UTF-8),
 * com escape correto de vírgulas, aspas e quebras de linha.
 */
export type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ];
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void {
  const blob = new Blob([buildCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
