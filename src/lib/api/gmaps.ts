const GMAPS_API_BASE = "https://gmaps.atomicabr.com.br/api/v1";

export interface GmapsJobData {
  keywords: string[];
  lang: string;
  zoom: number;
  lat: string;
  lon: string;
  fast_mode: boolean;
  radius: number;
  depth: number;
  email: boolean;
  max_time: number;
  proxies: string[] | null;
}

export interface GmapsJob {
  ID: string;
  Name: string;
  Date: string;
  Status: string;
  Data: GmapsJobData;
}

export interface CreateJobRequest {
  name: string;
  keywords: string[];
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
}

export const gmapsApi = {
  async listJobs(): Promise<GmapsJob[]> {
    const res = await fetch(`${GMAPS_API_BASE}/jobs`);
    if (!res.ok) throw new Error(`Failed to list jobs: ${res.status}`);
    return res.json();
  },

  async getJob(id: string): Promise<GmapsJob> {
    const res = await fetch(`${GMAPS_API_BASE}/jobs/${id}`);
    if (!res.ok) throw new Error(`Failed to get job: ${res.status}`);
    return res.json();
  },

  async createJob(data: CreateJobRequest): Promise<{ id: string }> {
    const res = await fetch(`${GMAPS_API_BASE}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        keywords: data.keywords,
        lang: data.lang || "pt",
        zoom: data.zoom || 15,
        lat: data.lat || "0",
        lon: data.lon || "0",
        fast_mode: data.fast_mode ?? false,
        radius: data.radius || 10000,
        depth: data.depth || 1,
        email: data.email ?? true,
        max_time: data.max_time || 480000000000,
        proxies: data.proxies || [],
      }),
    });
    if (!res.ok) throw new Error(`Failed to create job: ${res.status}`);
    return res.json();
  },

  async deleteJob(id: string): Promise<void> {
    const res = await fetch(`${GMAPS_API_BASE}/jobs/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete job: ${res.status}`);
  },

  getDownloadUrl(id: string): string {
    return `${GMAPS_API_BASE}/jobs/${id}/download`;
  },
};
