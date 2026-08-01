import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export interface OrgRateLimit {
  organization_id: string;
  max_concurrent: number;
  max_per_hour: number;
  notes: string | null;
  updated_at: string;
}

const DEFAULT: Pick<OrgRateLimit, "max_concurrent" | "max_per_hour"> = {
  max_concurrent: 5,
  max_per_hour: 100,
};

export function useOrgRateLimit() {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["org-rate-limit", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<OrgRateLimit | null> => {
      const { data, error } = await supabase
        .from("org_scrape_rate_limits")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .maybeSingle();
      if (error) throw error;
      return (data as OrgRateLimit | null) ?? null;
    },
  });
}

export function useUpsertOrgRateLimit() {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (
      patch: Partial<Pick<OrgRateLimit, "max_concurrent" | "max_per_hour" | "notes">>,
    ) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");
      const row = {
        organization_id: activeOrgId,
        max_concurrent: patch.max_concurrent ?? DEFAULT.max_concurrent,
        max_per_hour: patch.max_per_hour ?? DEFAULT.max_per_hour,
        notes: patch.notes ?? null,
      };
      const { data, error } = await supabase
        .from("org_scrape_rate_limits")
        .upsert(row, { onConflict: "organization_id" })
        .select()
        .single();
      if (error) throw error;
      return data as OrgRateLimit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-rate-limit"] }),
  });
}
