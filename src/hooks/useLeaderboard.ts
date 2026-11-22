import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export type LeaderboardMetric = "won_value" | "won_deals" | "activities" | "new_companies";

export interface LeaderboardRow {
  organization_id: string;
  user_id: string;
  full_name: string | null;
  month_start: string;
  won_deals: number;
  won_value: number;
  activities: number;
  new_companies: number;
}

export const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  won_value: "Receita ganha",
  won_deals: "Negócios ganhos",
  activities: "Atividades",
  new_companies: "Novas empresas",
};

export const METRICS: LeaderboardMetric[] = ["won_value", "won_deals", "activities", "new_companies"];

export function useLeaderboard(months = 1) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["org-leaderboard", activeOrgId, months],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_leaderboard")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("month_start", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as LeaderboardRow[];

      // Agrega os ultimos N meses por membro.
      const cutoff = new Date();
      cutoff.setUTCMonth(cutoff.getUTCMonth() - (months - 1));
      cutoff.setUTCDate(1);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      const acc = new Map<string, LeaderboardRow>();
      for (const r of rows) {
        if (r.month_start < cutoffIso) continue;
        const prev = acc.get(r.user_id);
        if (!prev) {
          acc.set(r.user_id, { ...r });
        } else {
          prev.won_deals += Number(r.won_deals);
          prev.won_value += Number(r.won_value);
          prev.activities += Number(r.activities);
          prev.new_companies += Number(r.new_companies);
          if (r.full_name) prev.full_name = r.full_name;
        }
      }
      return Array.from(acc.values());
    },
  });
}

export const rankBy = (rows: LeaderboardRow[], metric: LeaderboardMetric) =>
  [...rows].sort((a, b) => Number(b[metric]) - Number(a[metric]));