import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export type ICPValue = string | string[] | number[];

export interface ICPCriterion {
  id: string;
  label: string;
  type: "select" | "range" | "tags" | "text";
  value: ICPValue;
  weight: number;
}

export interface ICPConfig {
  id: string;
  name: string;
  is_active: boolean;
  criteria: ICPCriterion[];
  created_at: string;
  updated_at: string;
}

const DEFAULT_CRITERIA: ICPCriterion[] = [
  { id: "sector", label: "Setor / Indústria", type: "tags", value: ["SaaS B2B", "Fintech", "E-commerce"], weight: 90 },
  { id: "location", label: "Localização", type: "tags", value: ["São Paulo", "Rio de Janeiro", "Belo Horizonte"], weight: 70 },
  { id: "employees", label: "Nº de Funcionários", type: "range", value: [10, 500], weight: 60 },
  { id: "revenue", label: "Faturamento Anual (R$)", type: "range", value: [500000, 50000000], weight: 85 },
  { id: "online_presence", label: "Presença Online", type: "select", value: "strong", weight: 40 },
];

export function useICPConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const queryAll = useQuery({
    queryKey: ["ipc-configs"],
    queryFn: async (): Promise<ICPConfig[]> => {
      const { data, error } = await db
        .from("ipc_config")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        is_active: d.is_active ?? false,
        criteria: (d.criteria as unknown as ICPCriterion[]) || DEFAULT_CRITERIA,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));
    },
    staleTime: 30_000,
  });

  const activeConfig = queryAll.data?.find(c => c.is_active) || queryAll.data?.[0];

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, criteria, is_active = true }: { id?: string; name: string; criteria: ICPCriterion[]; is_active?: boolean }) => {
      if (id) {
        const { error } = await db
          .from("ipc_config")
          .update({ criteria: criteria as unknown as Json, name, is_active, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from("ipc_config")
          .insert({ user_id: user?.id, name, criteria: criteria as unknown as Json, is_active });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc-configs"] });
      toast({ title: "IPC salvo!", description: "Critérios atualizados com sucesso." });
    },
    onError: (err) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all first
      await db.from("ipc_config").update({ is_active: false }).neq("id", id);
      // Activate target
      const { error } = await db.from("ipc_config").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc-configs"] });
      toast({ title: "Configuração ativada", description: "O novo perfil IPC está agora em uso." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("ipc_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc-configs"] });
      toast({ title: "Configuração removida" });
    },
  });

  return { 
    configs: queryAll.data || [], 
    activeConfig,
    isLoading: queryAll.isLoading, 
    error: queryAll.error, 
    save: saveMutation.mutate, 
    isSaving: saveMutation.isPending,
    activate: activateMutation.mutate,
    delete: deleteMutation.mutate,
    DEFAULT_CRITERIA
  };
}
