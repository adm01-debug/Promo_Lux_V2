/**
 * Utilitário de exportação CSV compatível com Excel/PT-BR (BOM UTF-8),
 * com escape correto de vírgulas, aspas e quebras de linha.
 */
import { sanitizeCell } from "./exportCSV";

export type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  // sanitizeCell neutraliza injeção de fórmula (=, +, -, @, tab, CR) sem
  // corromper números negativos legítimos — mesma proteção de exportCSV.ts,
  // importada em vez de duplicada (a cópia anterior deste arquivo não tinha
  // a proteção e havia divergido).
  const s = sanitizeCell(value);
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
