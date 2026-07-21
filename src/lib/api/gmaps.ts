import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmaps-proxy`;

export interface ScrapeJob {
  id: string;
  external_id: string | null;
  name: string;
  status: string;
  source: string;
  config: {
    keywords: string[];
    lang: string;
    radius: number;
    depth: number;
    email: boolean;
    fast_mode: boolean;
    zoom?: number;
    lat?: string;
    lon?: string;
    max_time?: number;
    proxies?: string[];
  };
  auto_sync: boolean;
  results_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobRequest {
  name: string;
  keywords: string[];
  auto_sync?: boolean;
  lang?: string;
  zoom?: number;
  lat?: string;
  lon?: string;
  fast_mode?: boolean;
  radius?: number;
  depth?: number;
  email?: boolean;
  max_time?: number;
  proxies?: string[];
  extra_reviews?: boolean;
}

async function callProxy(action: string, options: RequestInit = {}, params: Record<string, string> = {}) {
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

export const gmapsApi = {
  async listJobs(): Promise<{ jobs: ScrapeJob[]; api_online: boolean }> {
    return callProxy("list");
  },

  async createJob(data: CreateJobRequest): Promise<{ id: string; external_id: string | null; status: string }> {
    // Transform flat request to structured schema
    const { name, auto_sync, ...config } = data;
    return callProxy("create", {
      method: "POST",
      body: JSON.stringify({ name, auto_sync, config }),
      headers: {
        "idempotency-key": crypto.randomUUID(),
      }
    });
  },

  async deleteJob(id: string): Promise<void> {
    await callProxy("delete", { method: "DELETE" }, { id });
  },

  async syncResults(jobId: string): Promise<{ companies_created: number; total_results: number }> {
    return callProxy("sync-results", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId }),
    });
  },

  async exportJob(jobId: string, format: "csv" | "json" = "csv"): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const params = new URLSearchParams({ action: "export", id: jobId, format });
    const res = await fetch(`${FUNCTIONS_URL}?${params}`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="([^"]+)"/);
    a.download = match?.[1] || `export.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

