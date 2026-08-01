/**
 * Converts an array of objects to a CSV string and triggers download.
 * Includes CSV injection protection against formula injection attacks.
 */

export const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function sanitizeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Prevent CSV injection: prefix dangerous chars with a single quote.
  // Skip valid numbers — a legitimate "-5" (delta, saldo negativo) starts
  // with "-" too, and prefixing it with "'" turns a numeric column into a
  // corrupted text cell ("'-5") in every spreadsheet reader.
  if (str.length > 0 && DANGEROUS_PREFIXES.some((p) => str.startsWith(p)) && Number.isNaN(Number(str))) {
    return `'${str}`;
  }
  return str;
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const str = sanitizeCell(row[h]);
          // Escape quotes and wrap in quotes if contains comma/newline/quote
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
