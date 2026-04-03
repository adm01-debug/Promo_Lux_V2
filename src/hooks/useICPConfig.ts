import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface ICPCriterion {
  id: string;
  label: string;
  type: "select" | "range" | "tags" | "text";
  value: any;
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

  const query = useQuery({
    queryKey: ["ipc-config"],
    queryFn: async (): Promise<ICPConfig> => {
      const { data, error } = await supabase
        .from("ipc_config")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          name: data.name,
          is_active: data.is_active ?? true,
          criteria: (data.criteria as unknown as ICPCriterion[]) || DEFAULT_CRITERIA,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }

      // No config exists — return defaults (will be saved on first "Salvar")
      return {
        id: "",
        name: "default",
        is_active: true,
        criteria: DEFAULT_CRITERIA,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, criteria }: { id: string; name: string; criteria: ICPCriterion[] }) => {
      if (id) {
        // Update existing
        const { error } = await supabase
          .from("ipc_config")
          .update({ criteria: criteria as any, name, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("ipc_config")
          .insert({ name, criteria: criteria as any, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc-config"] });
      toast({ title: "IPC salvo!", description: "Critérios atualizados com sucesso." });
    },
    onError: (err) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  return { config: query.data, isLoading: query.isLoading, error: query.error, save: saveMutation.mutate, isSaving: saveMutation.isPending };
}
