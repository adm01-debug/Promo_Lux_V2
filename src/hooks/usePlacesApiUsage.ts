import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export interface PlacesApiUsage {
  id: string;
  organization_id: string;
  month: string; // ISO date (primeiro dia do mês)
  calls_essentials: number;
  calls_pro: number;
  calls_enterprise: number;
  estimated_cost_usd: number;
  last_call_at: string | null;
}

const CURRENT_MONTH = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

export const usePlacesApiUsage = () => {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["places-api-usage", activeOrgId],
    enabled: !!activeOrgId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PlacesApiUsage | null> => {
      const { data, error } = await supabase
        .from("places_api_usage")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .eq("month", CURRENT_MONTH())
        .maybeSingle();
      if (error) throw error;
      return (data as PlacesApiUsage | null) ?? null;
    },
  });
};

export const GOOGLE_MONTHLY_CREDIT_USD = 200;
