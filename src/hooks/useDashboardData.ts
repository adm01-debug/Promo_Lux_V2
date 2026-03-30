import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  activeWorkflows: number;
  runningWorkflows: number;
  totalCompanies: number;
  enrichedCompanies: number;
  totalCompaniesCount: number;
  avgIpcScore: number;
  todayScrapeJobs: number;
  totalScrapeJobs: number;
  completedScrapeJobs: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: activeWorkflows },
    { count: runningWorkflows },
    { count: totalCompanies },
    { count: enrichedCompanies },
    { data: companiesForAvg },
    { count: todayScrapeJobs },
    { count: totalScrapeJobs },
    { count: completedScrapeJobs },
  ] = await Promise.all([
    supabase.from("workflows").select("*", { count: "exact", head: true }).in("status", ["active", "running"]),
    supabase.from("workflows").select("*", { count: "exact", head: true }).eq("status", "running"),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true),
    supabase.from("companies").select("ipc_score"),
    supabase.from("scrape_jobs").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("scrape_jobs").select("*", { count: "exact", head: true }),
    supabase.from("scrape_jobs").select("*", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  const scores = (companiesForAvg ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
  const avgIpcScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    activeWorkflows: activeWorkflows ?? 0,
    runningWorkflows: runningWorkflows ?? 0,
    totalCompanies: totalCompanies ?? 0,
    enrichedCompanies: enrichedCompanies ?? 0,
    totalCompaniesCount: totalCompanies ?? 0,
    avgIpcScore,
    todayScrapeJobs: todayScrapeJobs ?? 0,
    totalScrapeJobs: totalScrapeJobs ?? 0,
    completedScrapeJobs: completedScrapeJobs ?? 0,
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export interface RecentCompany {
  id: string;
  name: string;
  sector: string | null;
  location: string | null;
  ipc_score: number | null;
  source: string;
  website: string | null;
  enriched: boolean | null;
}

export function useRecentCompanies(limit = 6) {
  return useQuery({
    queryKey: ["recent-companies", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, sector, location, ipc_score, source, website, enriched")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RecentCompany[];
    },
    staleTime: 10_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
