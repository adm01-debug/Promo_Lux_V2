import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { getActiveOrgId } from "@/integrations/supabase/withOrg";

export interface DealPrediction {
  deal_id: string;
  win_probability: number;
  predicted_close_date: string | null;
  weighted_value: number;
  drivers: Record<string, unknown>;
  computed_at: string;
}

/**
 * Previsões de fechamento dos deals da organização ativa.
 *
 * O cálculo vive no banco (`compute_deal_prediction`), alimentado pelo
 * `refresh_org_scores`; aqui só materializamos num Map por deal_id para o
 * board pintar probabilidade e receita ponderada sem N+1.
 */
export function useDealPredictions() {
  const { user } = useAuth();
  const orgId = getActiveOrgId();

  const query = useQuery({
    queryKey: ["deal_predictions", orgId],
    enabled: !!user && !!orgId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_predictions")
        .select("deal_id, win_probability, predicted_close_date, weighted_value, drivers, computed_at")
        .eq("organization_id", orgId!)
        .order("win_probability", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DealPrediction[];
    },
  });

  const byDealId = new Map((query.data ?? []).map((p) => [p.deal_id, p]));
  const totalWeighted = (query.data ?? []).reduce((sum, p) => sum + Number(p.weighted_value ?? 0), 0);

  return {
    predictions: query.data ?? [],
    byDealId,
    totalWeighted,
    isLoading: query.isLoading,
  };
}