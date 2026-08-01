import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Estratégia de particionamento orientada a threshold.
 *
 * As políticas definem os limites (linhas/bytes) que, quando ultrapassados,
 * geram recomendações (advisories). A avaliação também roda automaticamente
 * via pg_cron uma vez ao dia; aqui expomos leitura + avaliação sob demanda.
 */

export interface PartitionPolicy {
  id: string;
  table_name: string;
  threshold_rows: number;
  threshold_bytes: number;
  partition_by: string;
  cooldown_hours: number;
  enabled: boolean;
  notes: string | null;
  updated_at: string;
}

export interface PartitionAdvisory {
  id: string;
  policy_id: string | null;
  table_name: string;
  live_rows: number;
  total_bytes: number;
  threshold_rows: number;
  threshold_bytes: number;
  breached_rows: boolean;
  breached_bytes: boolean;
  recommendation: string;
  acknowledged_at: string | null;
  created_at: string;
}

const POLICIES_KEY = ["partition-policies"] as const;
const ADVISORIES_KEY = ["partition-advisories"] as const;

export function usePartitionPolicies() {
  return useQuery({
    queryKey: POLICIES_KEY,
    queryFn: async (): Promise<PartitionPolicy[]> => {
      const { data, error } = await supabase
        .from("partition_policies")
        .select("*")
        .order("table_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PartitionPolicy[];
    },
    staleTime: 60_000,
  });
}

export function usePartitionAdvisories() {
  return useQuery({
    queryKey: ADVISORIES_KEY,
    queryFn: async (): Promise<PartitionAdvisory[]> => {
      const { data, error } = await supabase
        .from("partition_advisories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PartitionAdvisory[];
    },
    staleTime: 30_000,
  });
}

export function useEvaluatePartitions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("evaluate_partition_policies");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADVISORIES_KEY });
      qc.invalidateQueries({ queryKey: POLICIES_KEY });
      toast({ title: "Avaliação concluída", description: "Políticas de particionamento reavaliadas." });
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Falha ao avaliar políticas.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });
}

export function useAcknowledgeAdvisory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("partition_advisories")
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userRes.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADVISORIES_KEY });
      toast({ title: "Reconhecida", description: "Recomendação marcada como reconhecida." });
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Falha ao reconhecer.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(2)} ${units[i]}`;
}
