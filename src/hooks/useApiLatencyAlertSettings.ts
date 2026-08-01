import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Configuração de alertas de latência p95 por rota, por organização. */
export interface ApiLatencyAlertSettings {
  organization_id: string;
  p95_critical_ms: number;
  consecutive: number;
  cooldown_hours: number;
  enabled: boolean;
}

/** Valores padrão aplicados quando a organização ainda não tem configuração. */
export const API_LATENCY_ALERT_DEFAULTS: Omit<ApiLatencyAlertSettings, "organization_id"> = {
  p95_critical_ms: 1500,
  consecutive: 3,
  cooldown_hours: 6,
  enabled: true,
};

export function useApiLatencyAlertSettings(orgId: string | null) {
  return useQuery({
    queryKey: ["api-latency-alert-settings", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ApiLatencyAlertSettings> => {
      const { data, error } = await supabase
        .from("api_latency_alert_settings")
        .select("organization_id, p95_critical_ms, consecutive, cooldown_hours, enabled")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { organization_id: orgId!, ...API_LATENCY_ALERT_DEFAULTS };
    },
  });
}

export function useSaveApiLatencyAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: ApiLatencyAlertSettings) => {
      const { error } = await supabase.from("api_latency_alert_settings").upsert(
        {
          organization_id: settings.organization_id,
          p95_critical_ms: settings.p95_critical_ms,
          consecutive: settings.consecutive,
          cooldown_hours: settings.cooldown_hours,
          enabled: settings.enabled,
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["api-latency-alert-settings", vars.organization_id] });
      toast.success("Configuração de alertas de latência salva.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar configuração.";
      toast.error(msg);
    },
  });
}

/** Item do histórico de disparos de alerta de latência. */
export interface ApiLatencyAlertHistoryItem {
  id: string;
  created_at: string;
  path: string;
  p95_ms: number;
  p95_critical_ms: number;
  consecutive: number;
  admins_notified: number;
}

export function useApiLatencyAlertHistory(orgId: string | null, limit = 20) {
  return useQuery({
    queryKey: ["api-latency-alert-history", orgId, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<ApiLatencyAlertHistoryItem[]> => {
      const { data, error } = await supabase
        .from("api_latency_alert_history")
        .select("id, created_at, path, p95_ms, p95_critical_ms, consecutive, admins_notified")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ApiLatencyAlertHistoryItem[];
    },
    refetchInterval: 60_000,
  });
}
