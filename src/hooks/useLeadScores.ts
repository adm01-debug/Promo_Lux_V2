import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { getActiveOrgId } from "@/integrations/supabase/withOrg";
import { toast } from "sonner";

export interface LeadScore {
  stakeholder_id: string;
  score: number;
  tier: "hot" | "warm" | "cold";
  signals: Record<string, number>;
  computed_at: string;
}

export type LeadTier = LeadScore["tier"];

export const TIER_LABEL: Record<LeadTier, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

/**
 * Scores dos stakeholders da organização ativa.
 *
 * Lê a tabela materializada (escrita pelo RPC de recálculo) num único round-trip
 * e entrega um Map por stakeholder_id, para as listas resolverem em O(1) sem N+1.
 */
export function useLeadScores() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = getActiveOrgId();

  const query = useQuery({
    queryKey: ["lead_scores", orgId],
    enabled: !!user && !!orgId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_scores")
        .select("stakeholder_id, score, tier, signals, computed_at")
        .eq("organization_id", orgId!)
        .order("score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadScore[];
    },
  });

  const byId = new Map((query.data ?? []).map((s) => [s.stakeholder_id, s]));

  const refresh = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização ativa não definida");
      const { data, error } = await supabase.rpc("refresh_org_scores", { _org_id: orgId });
      if (error) throw error;
      return data as unknown as { leads_atualizados: number; deals_atualizados: number }[] | null;
    },
    onSuccess: (res) => {
      const r = Array.isArray(res) ? res[0] : res;
      toast.success("Scores recalculados", {
        description: `${r?.leads_atualizados ?? 0} stakeholders e ${r?.deals_atualizados ?? 0} deals atualizados.`,
      });
      void qc.invalidateQueries({ queryKey: ["lead_scores", orgId] });
      void qc.invalidateQueries({ queryKey: ["deal_predictions", orgId] });
    },
    onError: (err: Error) => {
      toast.error("Não foi possível recalcular os scores", { description: err.message });
    },
  });

  return { scores: query.data ?? [], byId, isLoading: query.isLoading, refresh };
}