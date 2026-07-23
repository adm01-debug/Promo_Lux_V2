import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReaperRun {
  id: string;
  ran_at: string;
  stale_after_seconds: number;
  instagram_requeued: number;
  instagram_dead: number;
  scrape_requeued: number;
  scrape_dead: number;
  web_requeued: number;
  web_dead: number;
  duration_ms: number | null;
}

/**
 * Histórico do cron `reap_stuck_queue_tasks` (Rodada #39 · G2).
 * Tabela global (sem organization_id): expõe SELECT a authenticated via RLS.
 */
export function useReaperHistory(limit = 50) {
  return useQuery({
    queryKey: ["reaper-runs", limit],
    queryFn: async (): Promise<ReaperRun[]> => {
      const { data, error } = await supabase
        .from("qa_reaper_runs")
        .select(
          "id, ran_at, stale_after_seconds, instagram_requeued, instagram_dead, scrape_requeued, scrape_dead, web_requeued, web_dead, duration_ms",
        )
        .order("ran_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ReaperRun[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
