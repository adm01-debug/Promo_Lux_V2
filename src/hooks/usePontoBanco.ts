import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";

export function usePontoBanco() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ponto-banco-horas", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("ponto_banco_horas" as any)
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
