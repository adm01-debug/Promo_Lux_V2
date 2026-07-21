import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { classifyDlqReason, type DlqReasonCategory } from "@/lib/dlq/classify";

export interface DlqItem {
  id: string;
  organization_id: string;
  scrape_job_id: string | null;
  source: string;
  attempts: number;
  last_error: string | null;
  failed_at: string;
  replayed_at: string | null;
  category: DlqReasonCategory;
  categoryLabel: string;
  retryable: boolean;
}

export function useDlqItems(limit = 200) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["dlq-items", activeOrgId, limit],
    enabled: !!activeOrgId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<DlqItem[]> => {
      const { data, error } = await supabase
        .from("scrape_dead_letter")
        .select("id, organization_id, scrape_job_id, source, attempts, last_error, failed_at, replayed_at")
        .eq("organization_id", activeOrgId!)
        .is("replayed_at", null)
        .order("failed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const c = classifyDlqReason(row.last_error);
        return {
          ...row,
          category: c.category,
          categoryLabel: c.label,
          retryable: c.retryable,
        } as DlqItem;
      });
    },
  });
}

export function useReplayDlqBatch() {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  return useMutation({
    mutationFn: async ({ limit = 500 }: { limit?: number }) => {
      const { data, error } = await supabase.rpc("replay_dead_letter_batch", {
        _organization_id: activeOrgId ?? undefined,
        _limit: limit,
      });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dlq-items"] });
      qc.invalidateQueries({ queryKey: ["dlq-health-metrics"] });
    },
  });
}
