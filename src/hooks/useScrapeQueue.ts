import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScrapeQueueItem {
  id: string;
  organization_id: string;
  scrape_job_id: string | null;
  source: string;
  payload: Record<string, unknown>;
  status: "queued" | "processing" | "succeeded" | "dead";
  attempts: number;
  max_attempts: number;
  priority: number;
  next_run_at: string;
  last_error: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeadLetterItem {
  id: string;
  queue_id: string | null;
  organization_id: string;
  scrape_job_id: string | null;
  source: string;
  payload: Record<string, unknown>;
  attempts: number;
  last_error: string | null;
  failed_at: string;
  replayed_at: string | null;
  created_at: string;
}

export function useScrapeQueue() {
  return useQuery({
    queryKey: ["scrape-queue"],
    queryFn: async (): Promise<ScrapeQueueItem[]> => {
      const { data, error } = await supabase
        .from("scrape_queue")
        .select("*")
        .order("next_run_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ScrapeQueueItem[];
    },
    refetchInterval: 15_000,
  });
}

export function useDeadLetterQueue() {
  return useQuery({
    queryKey: ["scrape-dead-letter"],
    queryFn: async (): Promise<DeadLetterItem[]> => {
      const { data, error } = await supabase
        .from("scrape_dead_letter")
        .select("*")
        .order("failed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DeadLetterItem[];
    },
    refetchInterval: 30_000,
  });
}

export function useReplayDeadLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dlqId: string) => {
      const { data, error } = await supabase.rpc("replay_dead_letter", { _dlq_id: dlqId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scrape-queue"] });
      qc.invalidateQueries({ queryKey: ["scrape-dead-letter"] });
      toast.success("Tarefa reenviada para a fila.");
    },
    onError: (err: Error) => {
      toast.error(`Falha ao reprocessar: ${err.message}`);
    },
  });
}
