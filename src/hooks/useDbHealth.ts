import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DbHealthSnapshot {
  id: string;
  captured_at: string;
  active_connections: number;
  max_connections: number;
  connection_pct: number;
  db_size_bytes: number;
  postmaster_start: string;
  restart_detected: boolean;
  commits: number;
  rollbacks: number;
  deadlocks: number;
  cache_hit_ratio: number;
  longest_query_secs: number;
}

export type AlertSeverity = "critical" | "warning" | "ok";

export interface HealthAlert {
  key: string;
  label: string;
  severity: AlertSeverity;
  message: string;
  value: string;
  baseline?: string;
}

const HISTORY_LIMIT = 288; // ~24h at 5min cadence

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Computa baseline (média + desvio) sobre o histórico e classifica alertas.
 * Combina limites absolutos (guarda-corpo) com desvios estatísticos.
 */
export function computeAlerts(snapshots: DbHealthSnapshot[]): HealthAlert[] {
  if (snapshots.length === 0) return [];
  const latest = snapshots[0];
  const history = snapshots.slice(1); // baseline exclui o ponto atual
  const alerts: HealthAlert[] = [];

  // --- Saturação de conexões ---
  const connBaseline = history.map((s) => s.connection_pct);
  const connMean = mean(connBaseline);
  const connSd = stddev(connBaseline);
  const connThreshold = Math.max(connMean + 2 * connSd, 80);
  alerts.push({
    key: "connections",
    label: "Conexões",
    value: `${latest.connection_pct}% (${latest.active_connections}/${latest.max_connections})`,
    baseline: connBaseline.length ? `média ${connMean.toFixed(1)}%` : undefined,
    severity: latest.connection_pct >= 90 ? "critical" : latest.connection_pct >= connThreshold ? "warning" : "ok",
    message:
      latest.connection_pct >= 90
        ? "Saturação crítica de conexões — considere aumentar o pool/instância."
        : latest.connection_pct >= connThreshold
        ? "Uso de conexões acima do baseline."
        : "Dentro do baseline.",
  });

  // --- Cache hit ratio ---
  const cacheBaseline = history.map((s) => s.cache_hit_ratio);
  const cacheMean = mean(cacheBaseline);
  alerts.push({
    key: "cache",
    label: "Cache hit ratio",
    value: `${latest.cache_hit_ratio}%`,
    baseline: cacheBaseline.length ? `média ${cacheMean.toFixed(1)}%` : undefined,
    severity: latest.cache_hit_ratio < 90 ? "critical" : latest.cache_hit_ratio < 98 ? "warning" : "ok",
    message:
      latest.cache_hit_ratio < 90
        ? "Cache hit baixo — leituras indo a disco, risco de pressão de memória."
        : latest.cache_hit_ratio < 98
        ? "Cache hit abaixo do ideal."
        : "Memória/cache saudáveis.",
  });

  // --- Reinícios ---
  const restarts = snapshots.filter((s) => s.restart_detected).length;
  alerts.push({
    key: "restarts",
    label: "Reinícios",
    value: restarts === 0 ? "nenhum" : `${restarts} no período`,
    severity: latest.restart_detected ? "critical" : restarts > 0 ? "warning" : "ok",
    message: latest.restart_detected
      ? "Reinício detectado na última coleta — investigar causa (OOM/deploy)."
      : restarts > 0
      ? "Houve reinícios recentes no período monitorado."
      : "Sem reinícios no período.",
  });

  // --- Consulta mais longa em execução ---
  const longMean = mean(history.map((s) => s.longest_query_secs));
  const longThreshold = Math.max(longMean + 2 * stddev(history.map((s) => s.longest_query_secs)), 30);
  alerts.push({
    key: "long_query",
    label: "Consulta mais longa",
    value: `${latest.longest_query_secs}s`,
    baseline: history.length ? `média ${longMean.toFixed(1)}s` : undefined,
    severity: latest.longest_query_secs >= 120 ? "critical" : latest.longest_query_secs >= longThreshold ? "warning" : "ok",
    message:
      latest.longest_query_secs >= 120
        ? "Consulta muito longa em execução — possível lock/query travada."
        : latest.longest_query_secs >= longThreshold
        ? "Consulta acima do baseline de duração."
        : "Consultas dentro do baseline.",
  });

  // --- Deadlocks (crescimento) ---
  const prevDeadlocks = history[0]?.deadlocks ?? latest.deadlocks;
  const deadlockDelta = latest.deadlocks - prevDeadlocks;
  alerts.push({
    key: "deadlocks",
    label: "Deadlocks",
    value: `${latest.deadlocks} (Δ ${deadlockDelta >= 0 ? "+" : ""}${deadlockDelta})`,
    severity: deadlockDelta > 0 ? "warning" : "ok",
    message: deadlockDelta > 0 ? "Novos deadlocks desde a última coleta." : "Sem novos deadlocks.",
  });

  return alerts;
}

export function useDbHealth() {
  return useQuery({
    queryKey: ["db-health-snapshots"],
    queryFn: async (): Promise<DbHealthSnapshot[]> => {
      const { data, error } = await supabase
        .from("db_health_snapshots")
        .select("*")
        .order("captured_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      return (data ?? []) as DbHealthSnapshot[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
