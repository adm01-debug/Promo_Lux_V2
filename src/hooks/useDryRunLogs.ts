import { useCallback, useEffect, useState } from "react";

/**
 * Log local (sem backend) das execuções de dry-run do OAuth Sandbox.
 * Persistido em localStorage para auditoria offline; útil para identificar
 * quando uma configuração começou a falhar sem consultar logs do servidor.
 */

export interface DryRunLogEntry {
  id: string;
  timestamp: string; // ISO
  provider: "gmail" | "outlook" | string;
  scope_type: "user" | "organization" | string;
  redirect_uri: string;
  scopes: string[];
  client_id_configured: boolean;
  client_secret_configured: boolean;
  warnings: string[];
  error?: string | null;
  outcome: "ok" | "warning" | "error";
}

const STORAGE_KEY = "lux:oauth:dry-run-logs";
const MAX_ENTRIES = 200;

function read(): DryRunLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DryRunLogEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: DryRunLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new CustomEvent("lux:dry-run-logs:update"));
  } catch {
    /* quota / private mode */
  }
}

export function useDryRunLogs() {
  const [logs, setLogs] = useState<DryRunLogEntry[]>(() => read());

  useEffect(() => {
    const refresh = () => setLogs(read());
    window.addEventListener("lux:dry-run-logs:update", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("lux:dry-run-logs:update", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const append = useCallback((entry: Omit<DryRunLogEntry, "id" | "timestamp" | "outcome"> & { outcome?: DryRunLogEntry["outcome"] }) => {
    const outcome: DryRunLogEntry["outcome"] =
      entry.outcome ?? (entry.error ? "error" : entry.warnings.length > 0 ? "warning" : "ok");
    const next: DryRunLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
      outcome,
    };
    const updated = [next, ...read()].slice(0, MAX_ENTRIES);
    write(updated);
    setLogs(updated);
    return next;
  }, []);

  const clear = useCallback(() => {
    write([]);
    setLogs([]);
  }, []);

  const exportJson = useCallback(() => {
    return JSON.stringify(read(), null, 2);
  }, []);

  return { logs, append, clear, exportJson };
}