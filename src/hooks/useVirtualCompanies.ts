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
      // In a real 10/10 app, we'd use pagination or infinite query, 
      // but for "large lists" with virtualization, 1000 is a good stress test.
      const { data, error } = await db
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 mins
  });
}
