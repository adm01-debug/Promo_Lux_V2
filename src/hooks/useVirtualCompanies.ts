import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";

/**
 * useVirtualCompanies
 * Fornece uma lista de empresas preparada para virtualização.
 */
export function useVirtualCompanies(limit = 1000) {
  return useQuery({
    queryKey: ["companies-virtual", limit],
    queryFn: async () => {
      const { data, error } = await db.from("companies").select("*").limit(limit);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });
}
