/**
 * Utilitários puros para o histórico do Oráculo.
 * Extraídos do componente para viabilizar testes unitários determinísticos.
 */

export type DMHistoryStatus = "done" | "failed" | "cancelled" | "processing" | "queued";

export interface DMHistoryEntry {
  id: string;
  domain: string;
  linkedin: string | null;
  startedAt: string;
  finishedAt: string;
  status: DMHistoryStatus;
  total: number;
  message?: string | null;
  durationMs: number | null;
}

export interface HistoryFilters {
  q: string;
  status: "all" | DMHistoryStatus;
  from: string; // yyyy-mm-dd
  to: string;   // yyyy-mm-dd
}

export const STATUS_LABELS: Record<DMHistoryStatus, string> = {
  done: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  processing: "Processando",
  queued: "Em fila",
};

export function filterHistory(entries: DMHistoryEntry[], f: HistoryFilters): DMHistoryEntry[] {
  const q = f.q.trim().toLowerCase();
  const fromTs = f.from ? new Date(f.from + "T00:00:00").getTime() : null;
  const toTs = f.to ? new Date(f.to + "T23:59:59").getTime() : null;
  return entries.filter((h) => {
    if (q && !h.domain.toLowerCase().includes(q) && !(h.linkedin ?? "").toLowerCase().includes(q)) return false;
    if (f.status !== "all" && h.status !== f.status) return false;
    const t = new Date(h.finishedAt).getTime();
    if (!Number.isFinite(t)) return false;
    if (fromTs != null && t < fromTs) return false;
    if (toTs != null && t > toTs) return false;
    return true;
  });
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function findRecentDuplicate(
  entries: DMHistoryEntry[],
  domainInput: string,
  now: number = Date.now(),
): DMHistoryEntry | null {
  const d = normalizeDomain(domainInput);
  if (!d) return null;
  const cutoff = now - DUPLICATE_WINDOW_MS;
  const last = entries.find((h) => {
    if (h.status === "queued" || h.status === "processing") return false;
    const t = new Date(h.finishedAt).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;
    return h.domain.toLowerCase() === d;
  });
  return last ?? null;
}

export function buildHistoryCsvRows(entries: DMHistoryEntry[]): Array<Record<string, string | number>> {
  return entries.map((h) => ({
    "Domínio": h.domain,
    "LinkedIn": h.linkedin ?? "",
    "Status": STATUS_LABELS[h.status] ?? h.status,
    "Decisores": h.total,
    "Duração (ms)": h.durationMs ?? "",
    "Duração": formatDurationMs(h.durationMs),
    "Iniciada em": new Date(h.startedAt).toISOString(),
    "Finalizada em": new Date(h.finishedAt).toISOString(),
    "Mensagem": h.message ?? "",
  }));
}
