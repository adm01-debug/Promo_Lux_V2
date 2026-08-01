import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Estatística de latência agregada por rota da API/edge function. */
export interface ApiLatencyStat {
  path: string;
  requests: number;
  errors: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  avg_ms: number;
}

export type LatencySeverity = "critical" | "warning" | "ok";

/** Guarda-corpos de latência p95 (ms) para classificação visual. */
export const LATENCY_THRESHOLDS = {
  p95WarnMs: 500,
  p95CriticalMs: 1500,
  errorRateWarn: 1, // %
  errorRateCritical: 5, // %
};

/** Severidade de uma rota combinando latência p95 e taxa de erro. */
export function latencySeverity(stat: ApiLatencyStat): LatencySeverity {
  if (
    stat.p95_ms >= LATENCY_THRESHOLDS.p95CriticalMs ||
    stat.error_rate >= LATENCY_THRESHOLDS.errorRateCritical
  ) {
    return "critical";
  }
  if (
    stat.p95_ms >= LATENCY_THRESHOLDS.p95WarnMs ||
    stat.error_rate >= LATENCY_THRESHOLDS.errorRateWarn
  ) {
    return "warning";
  }
  return "ok";
}

/**
 * Latência das APIs por rota (p50/p95/p99, volume e taxa de erro) numa
 * janela de horas. Backed pela RPC `api_latency_stats` (SECURITY DEFINER,
 * isolada por organização).
 */
export function useApiLatency(hours = 24, limit = 20) {
  return useQuery({
    queryKey: ["api-latency-stats", hours, limit],
    queryFn: async (): Promise<ApiLatencyStat[]> => {
      const { data, error } = await supabase.rpc("api_latency_stats", {
        _hours: hours,
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as ApiLatencyStat[];
    },
    refetchInterval: 60_000,
  });
}

/** Ponto de série temporal da latência agregada por bucket de tempo. */
export interface ApiLatencyTrendPoint {
  bucket: string;
  requests: number;
  errors: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
}

/**
 * Tendência de latência p95 ao longo do tempo (buckets horários por padrão),
 * agregada por toda a organização. Backed pela RPC `api_latency_trend`
 * (SECURITY DEFINER, isolada por organização).
 */
export function useApiLatencyTrend(hours = 24, bucketMinutes = 60) {
  return useQuery({
    queryKey: ["api-latency-trend", hours, bucketMinutes],
    queryFn: async (): Promise<ApiLatencyTrendPoint[]> => {
      const { data, error } = await supabase.rpc("api_latency_trend", {
        _hours: hours,
        _bucket_minutes: bucketMinutes,
      });
      if (error) throw error;
      return (data ?? []) as ApiLatencyTrendPoint[];
    },
    refetchInterval: 60_000,
  });
}
