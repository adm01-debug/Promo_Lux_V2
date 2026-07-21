import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WebScrapeTask {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  trace_id: string;
  url: string;
  result_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebScrapeResult {
  id: string;
  url: string;
  final_url: string | null;
  http_status: number | null;
  title: string | null;
  description: string | null;
  markdown: string | null;
  links: { href: string; text: string }[];
  extracted_json: unknown;
  bytes: number | null;
  duration_ms: number | null;
  fetched_at: string;
  partial_content: boolean;
}

export interface EnqueueOptions {
  url: string;
  formats?: ("markdown" | "html" | "links")[];
  extract_schema?: Record<string, unknown>;
  wait_for_ms?: number;
  max_bytes?: number;
  priority?: number;
}

async function invoke<T>(fn: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const url = new URL(`https://pesfxhlbsjfmlysdkzhr.supabase.co/functions/v1/${fn}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const res = await fetch(url.toString(), {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json as T;
}

/** Enfileira uma URL para scraping. */
export function useEnqueueWebScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: EnqueueOptions) =>
      invoke<{ task_id: string; trace_id: string; deduplicated?: boolean }>("web-scrape-enqueue", opts),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["web-scrape-tasks"] });
      toast.success(
        data.deduplicated
          ? "Tarefa já estava na fila — reaproveitada."
          : "URL enfileirada com sucesso.",
      );
    },
    onError: (e: Error) => toast.error(`Falha ao enfileirar: ${e.message}`),
  });
}

/** Lista as tasks recentes da organização ativa. */
export function useWebScrapeTasks(limit = 50) {
  return useQuery({
    queryKey: ["web-scrape-tasks", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_scrape_queue")
        .select("id, url, status, attempts, max_attempts, last_error, trace_id, result_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WebScrapeTask[];
    },
    refetchInterval: 5_000,
  });
}

/** Detalhes de uma task específica (com resultado). */
export function useWebScrapeStatus(taskId: string | null) {
  return useQuery({
    queryKey: ["web-scrape-status", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      if (!taskId) return null;
      return invoke<{ task: WebScrapeTask; result: WebScrapeResult | null }>(
        "web-scrape-status",
        undefined,
        { task_id: taskId },
      );
    },
    refetchInterval: (query) => {
      const s = query.state.data?.task?.status;
      return s === "queued" || s === "processing" ? 3_000 : false;
    },
  });
}

/** Aciona a extração AI para uma task já concluída. */
export function useWebScrapeExtract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { task_id: string; schema: Record<string, unknown>; instruction?: string }) =>
      invoke<{ extracted: unknown; usage: unknown }>("web-scrape-extract", input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["web-scrape-status", vars.task_id] });
      toast.success("Extração concluída.");
    },
    onError: (e: Error) => toast.error(`Falha na extração: ${e.message}`),
  });
}

/** Reprocessa a DLQ do motor web. */
export function useReplayWebDlq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (limit = 100): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("replay_web_dead_letter_batch", { _limit: limit });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (count: number) => {
      qc.invalidateQueries({ queryKey: ["web-scrape-tasks"] });
      toast.success(`${count} tarefas reenviadas para a fila.`);
    },
    onError: (e: Error) => toast.error(`Falha ao reprocessar DLQ: ${e.message}`),
  });
}

/** Métricas de saúde da DLQ web. */
export function useWebDlqHealth() {
  return useQuery({
    queryKey: ["web-dlq-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("web_dlq_health_metrics").single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

/** Estado auxiliar de UI para o painel. */
export function useWebScrapeState() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const select = useCallback((id: string | null) => setSelectedTaskId(id), []);
  return { selectedTaskId, select };
}
