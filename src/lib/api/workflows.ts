import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine`;

export interface WorkflowStep {
  id: string;
  type: "source" | "enrich" | "filter" | "action";
  label: string;
  provider?: string;
}

export interface WorkflowRunResults {
  scrape?: { status?: string; [key: string]: unknown };
  enrich?: { companies_imported?: number; [key: string]: unknown };
  ipc_score?: { companies_scored?: number; [key: string]: unknown };
  summary?: { total_companies?: number; qualified?: number; success_rate?: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WorkflowRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  results: WorkflowRunResults;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  steps: WorkflowStep[];
  config: Record<string, unknown>;
  leads_processed: number;
  leads_qualified: number;
  success_rate: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  workflow_runs?: WorkflowRun[];
}

async function callWorkflowApi(action: string, options: RequestInit = {}, params: Record<string, string> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const searchParams = new URLSearchParams({ action, ...params });
  const res = await fetch(`${FUNCTIONS_URL}?${searchParams}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const workflowApi = {
  async list(): Promise<Workflow[]> {
    return callWorkflowApi("list");
  },

  async create(data: { name: string; description: string; steps: WorkflowStep[]; config: Record<string, unknown> }): Promise<Workflow> {
    return callWorkflowApi("create", { method: "POST", body: JSON.stringify(data) });
  },

  async run(workflowId: string): Promise<{ run_id: string; results: Record<string, unknown> }> {
    return callWorkflowApi("run", { method: "POST", body: JSON.stringify({ workflow_id: workflowId }) });
  },

  async toggleStatus(workflowId: string, newStatus: string): Promise<void> {
    await callWorkflowApi("toggle-status", {
      method: "POST",
      body: JSON.stringify({ workflow_id: workflowId, new_status: newStatus }),
    });
  },

  async delete(workflowId: string): Promise<void> {
    await callWorkflowApi("delete", { method: "DELETE" }, { id: workflowId });
  },
};
