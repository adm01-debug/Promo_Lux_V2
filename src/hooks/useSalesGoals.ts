import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "@/hooks/use-toast";

export type GoalPeriod = "month" | "quarter" | "year";
export type GoalMetric = "won_value" | "won_deals" | "activities" | "new_companies";

export interface GoalProgress {
  goal_id: string;
  organization_id: string;
  owner_id: string | null;
  owner_name: string | null;
  period: GoalPeriod;
  period_start: string;
  metric: GoalMetric;
  target: number;
  achieved: number;
  pct: number;
}

export const METRIC_LABEL: Record<GoalMetric, string> = {
  won_value: "Receita ganha",
  won_deals: "Negócios ganhos",
  activities: "Atividades",
  new_companies: "Novas empresas",
};

export const PERIOD_LABEL: Record<GoalPeriod, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  year: "Anual",
};

export const METRICS: GoalMetric[] = ["won_value", "won_deals", "activities", "new_companies"];
export const PERIODS: GoalPeriod[] = ["month", "quarter", "year"];

export const startOfCurrentPeriod = (period: GoalPeriod): string => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === "year") return new Date(Date.UTC(y, 0, 1)).toISOString().slice(0, 10);
  if (period === "quarter") return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)).toISOString().slice(0, 10);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
};

export function useSalesGoals(period?: GoalPeriod) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["sales-goals", activeOrgId, period ?? "all"],
    enabled: !!activeOrgId,
    queryFn: async () => {
      let q = supabase
        .from("sales_goals_detailed")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("period_start", { ascending: false });
      if (period) q = q.eq("period", period);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoalProgress[];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (input: {
      owner_id: string | null;
      period: GoalPeriod;
      period_start: string;
      metric: GoalMetric;
      target: number;
    }) => {
      const { data, error } = await supabase
        .from("sales_goals")
        .insert({ ...input, organization_id: activeOrgId! })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-goals"] });
      toast({ title: "Meta criada" });
    },
    onError: (e: Error) =>
      toast({
        title: "Erro ao criar meta",
        description: e.message.includes("sales_goals_unique_scope")
          ? "Já existe uma meta com esse dono, período e métrica."
          : e.message,
        variant: "destructive",
      }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, target }: { id: string; target: number }) => {
      const { error } = await supabase.from("sales_goals").update({ target }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-goals"] });
      toast({ title: "Meta atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-goals"] });
      toast({ title: "Meta removida" });
    },
    onError: (e: Error) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });
}