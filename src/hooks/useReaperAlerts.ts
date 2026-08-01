import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReaperAlertReason = "dead_detected" | "no_recent_run";

export interface ReaperAlert {
  id: string;
  triggered_at: string;
  reason: ReaperAlertReason;
  instagram_dead: number;
  scrape_dead: number;
  web_dead: number;
  consecutive: number;
  last_run_at: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Histórico de alertas do cron `reaper-alerts` (Rodada #40 · Melhoria #2).
 * Global (sem organization_id); SELECT liberado para authenticated.
 */
export function useReaperAlerts(limit = 20) {
  return useQuery({
    queryKey: ["reaper-alerts", limit],
    queryFn: async (): Promise<ReaperAlert[]> => {
      const { data, error } = await supabase
        .from("reaper_alert_history")
        .select(
          "id, triggered_at, reason, instagram_dead, scrape_dead, web_dead, consecutive, last_run_at, details",
        )
        .order("triggered_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ReaperAlert[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
