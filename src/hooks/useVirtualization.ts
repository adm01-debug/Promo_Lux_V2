import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useMemo } from "react";

/**
 * useVirtualList
 * Helper hook para lógica de virtualização básica ou integração com bibliotecas.
 * Por enquanto, foca em fornecer dados paginados de forma performática.
 */
export function useVirtualCompanies(limit = 100) {
  return useQuery({
    queryKey: ["companies-virtual", limit],
    queryFn: async () => {
      const { data, error } = await db.from("companies").select("*").limit(limit);
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });
}
