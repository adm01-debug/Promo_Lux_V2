import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PontoTipo } from "./usePonto";

export interface RequestAjustePayload {
  registro_id?: string;
  data_nova: string;
  tipo: PontoTipo;
  motivo: string;
}

export function usePontoMelhorado() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: meusAjustes, isLoading } = useQuery({
    queryKey: ["ponto-meus-ajustes", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("ponto_ajustes" as any)
        .select(`
          *,
          registro:ponto_registros(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const solicitarAjuste = useMutation({
    mutationFn: async (payload: RequestAjustePayload) => {
      const { data, error } = await db
        .from("ponto_ajustes" as any)
        .insert({
          ...payload,
          user_id: user?.id,
          status: 'pendente'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-meus-ajustes"] });
      toast.success("Solicitação de ajuste enviada para aprovação!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao solicitar ajuste");
    }
  });

  return {
    meusAjustes,
    isLoading,
    solicitarAjuste: solicitarAjuste.mutateAsync,
    isSubmitting: solicitarAjuste.isPending
  };
}
