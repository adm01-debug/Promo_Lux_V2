import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DlqAlertSettings {
  organization_id: string;
  pending_critical: number;
  consecutive: number;
  cooldown_hours: number;
  enabled: boolean;
}

/** Valores padrão aplicados quando a organização ainda não tem configuração. */
export const DLQ_ALERT_DEFAULTS: Omit<DlqAlertSettings, "organization_id"> = {
  pending_critical: 100,
  consecutive: 3,
  cooldown_hours: 6,
  enabled: true,
};

export function useDlqAlertSettings(orgId: string | null) {
  return useQuery({
    queryKey: ["dlq-alert-settings", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<DlqAlertSettings> => {
      const { data, error } = await supabase
        .from("dlq_alert_settings")
        .select("organization_id, pending_critical, consecutive, cooldown_hours, enabled")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { organization_id: orgId!, ...DLQ_ALERT_DEFAULTS };
    },
  });
}

export function useSaveDlqAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: DlqAlertSettings) => {
      const { error } = await supabase
        .from("dlq_alert_settings")
        .upsert(
          {
            organization_id: settings.organization_id,
            pending_critical: settings.pending_critical,
            consecutive: settings.consecutive,
            cooldown_hours: settings.cooldown_hours,
            enabled: settings.enabled,
          },
          { onConflict: "organization_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dlq-alert-settings", vars.organization_id] });
      toast.success("Configuração de alertas da DLQ salva.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar configuração.";
      toast.error(msg);
    },
  });
}

export interface DlqAlertHistoryItem {
  id: string;
  triggered_at: string;
  pending_items: number;
  pending_critical: number;
  consecutive: number;
  admins_notified: number;
}

export function useDlqAlertHistory(orgId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["dlq-alert-history", orgId, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<DlqAlertHistoryItem[]> => {
      const { data, error } = await supabase
        .from("dlq_alert_history")
        .select("id, triggered_at, pending_items, pending_critical, consecutive, admins_notified")
        .eq("organization_id", orgId!)
        .order("triggered_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as DlqAlertHistoryItem[];
    },
    refetchInterval: 60_000,
  });
}
