import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Configuração global (singleton) dos alertas de disjuntor. Somente admins
 * conseguem ler ou alterar via RLS.
 */
export interface CircuitBreakerAlertSettings {
  enabled: boolean;
  alert_on_open: boolean;
  failure_count_threshold: number;
  cooldown_minutes: number;
}

export const CB_ALERT_DEFAULTS: CircuitBreakerAlertSettings = {
  enabled: true,
  alert_on_open: true,
  failure_count_threshold: 3,
  cooldown_minutes: 30,
};

export function useCircuitBreakerAlertSettings() {
  return useQuery({
    queryKey: ["cb-alert-settings"],
    queryFn: async (): Promise<CircuitBreakerAlertSettings> => {
      const { data, error } = await supabase
        .from("circuit_breaker_alert_settings")
        .select("enabled, alert_on_open, failure_count_threshold, cooldown_minutes")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? CB_ALERT_DEFAULTS;
    },
  });
}

export function useSaveCircuitBreakerAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: CircuitBreakerAlertSettings) => {
      const { error } = await supabase
        .from("circuit_breaker_alert_settings")
        .upsert({ id: true, ...settings }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cb-alert-settings"] });
      toast.success("Configuração de alertas dos disjuntores salva.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar configuração.";
      toast.error(msg);
    },
  });
}

export interface CircuitBreakerAlertHistoryItem {
  id: string;
  triggered_at: string;
  service_name: string;
  state: string;
  failure_count: number;
  reason: string;
  admins_notified: number;
}

export function useCircuitBreakerAlertHistory(limit = 20) {
  return useQuery({
    queryKey: ["cb-alert-history", limit],
    queryFn: async (): Promise<CircuitBreakerAlertHistoryItem[]> => {
      const { data, error } = await supabase
        .from("circuit_breaker_alert_history")
        .select("id, triggered_at, service_name, state, failure_count, reason, admins_notified")
        .order("triggered_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CircuitBreakerAlertHistoryItem[];
    },
    refetchInterval: 60_000,
  });
}

export interface CircuitBreakerSnapshot {
  id: string;
  captured_at: string;
  service_name: string;
  state: string;
  failure_count: number;
  threshold: number;
  opened_at: string | null;
  last_failure_at: string | null;
}

/**
 * Snapshots recentes por serviço, ordenados por data de captura desc.
 * Útil para gráficos de tendência (failure_count ao longo do tempo).
 */
export function useCircuitBreakerSnapshots(hours = 24, limit = 500) {
  return useQuery({
    queryKey: ["cb-snapshots", hours, limit],
    queryFn: async (): Promise<CircuitBreakerSnapshot[]> => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("circuit_breaker_snapshots")
        .select(
          "id, captured_at, service_name, state, failure_count, threshold, opened_at, last_failure_at",
        )
        .gte("captured_at", since)
        .order("captured_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CircuitBreakerSnapshot[];
    },
    refetchInterval: 60_000,
  });
}
