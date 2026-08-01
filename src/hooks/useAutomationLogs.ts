import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationExecutionLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  workflow_id: string | null;
  run_id: string | null;
  scrape_job_id: string | null;
  queue_task_id: string | null;
  source: string;
  step_name: string | null;
  step_index: number | null;
  phase: string;
  status: string;
  level: "info" | "warn" | "error";
  message: string | null;
  failure_reason: string | null;
  error_detail: string | null;
  http_status: number | null;
  transient: boolean | null;
  duration_ms: number | null;
  attempt: number | null;
  max_attempts: number | null;
  correlation_id: string | null;
  worker_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutomationLogFilters {
  level?: "all" | "info" | "warn" | "error";
  phase?: string;
  search?: string;
}

export function useAutomationLogs(filters: AutomationLogFilters = {}) {
  return useQuery({
    queryKey: ["automation-execution-logs", filters],
    queryFn: async (): Promise<AutomationExecutionLog[]> => {
      let query = supabase
        .from("automation_execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filters.level && filters.level !== "all") {
        query = query.eq("level", filters.level);
      }
      if (filters.phase && filters.phase !== "all") {
        query = query.eq("phase", filters.phase);
      }
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `message.ilike.${term},failure_reason.ilike.${term},step_name.ilike.${term}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AutomationExecutionLog[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
