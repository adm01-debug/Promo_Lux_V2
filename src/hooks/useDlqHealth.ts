import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DlqHealthMetrics {
  total_items: number;
  pending_items: number;
  replayed_items: number;
  oldest_pending_age_secs: number;
  added_last_24h: number;
  replayed_last_24h: number;
}

export type DlqHealthSeverity = "critical" | "warning" | "ok";

/** Limites de saúde da DLQ (guarda-corpos de observabilidade). */
export const DLQ_THRESHOLDS = {
  /** Nº de itens pendentes que dispara atenção / alerta. */
  pendingWarn: 25,
  pendingCritical: 100,
  /** Idade do item pendente mais antigo (segundos). */
  ageWarnSecs: 6 * 3600, // 6h
  ageCriticalSecs: 24 * 3600, // 24h
};

export function dlqSeverity(m: DlqHealthMetrics | undefined): DlqHealthSeverity {
  if (!m) return "ok";
  if (
    m.pending_items >= DLQ_THRESHOLDS.pendingCritical ||
    m.oldest_pending_age_secs >= DLQ_THRESHOLDS.ageCriticalSecs
  ) {
    return "critical";
  }
  if (
    m.pending_items >= DLQ_THRESHOLDS.pendingWarn ||
    m.oldest_pending_age_secs >= DLQ_THRESHOLDS.ageWarnSecs
  ) {
    return "warning";
  }
  return "ok";
}

export function useDlqHealth() {
  return useQuery({
    queryKey: ["dlq-health-metrics"],
    queryFn: async (): Promise<DlqHealthMetrics> => {
      const { data, error } = await supabase.rpc("dlq_health_metrics");
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as DlqHealthMetrics | undefined;
      return (
        row ?? {
          total_items: 0,
          pending_items: 0,
          replayed_items: 0,
          oldest_pending_age_secs: 0,
          added_last_24h: 0,
          replayed_last_24h: 0,
        }
      );
    },
    refetchInterval: 30_000,
  });
}

export interface DlqTrendPoint {
  captured_at: string;
  pending_items: number;
  total_items: number;
  replayed_items: number;
  oldest_pending_age_secs: number;
}

/** Série temporal de pendências da DLQ (para mini-gráfico de tendência). */
export function useDlqTrend(hours = 48) {
  return useQuery({
    queryKey: ["dlq-health-trend", hours],
    queryFn: async (): Promise<DlqTrendPoint[]> => {
      const { data, error } = await supabase.rpc("dlq_health_trend", { _hours: hours });
      if (error) throw error;
      return (data ?? []) as DlqTrendPoint[];
    },
    refetchInterval: 60_000,
  });
}
