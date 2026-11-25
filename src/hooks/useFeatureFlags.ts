import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import type { Json } from "@/integrations/supabase/types";

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rules: Json;
}

export const useFeatureFlags = () => {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["feature-flags", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*");
      
      if (error) throw error;
      
      const flags: Record<string, boolean> = {};
      data?.forEach(flag => {
        if (flag.flag_key) {
          flags[flag.flag_key] = !!flag.is_enabled;
        }
      });
      return flags;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useFeatureFlag = (name: string) => {
  const { data: flags } = useFeatureFlags();
  return !!flags?.[name];
};
