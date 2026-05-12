import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_STATS, DEMO_COMPANIES, DEMO_ACTIVITY } from "@/lib/demoData";

export interface DashboardStats {
  activeWorkflows: number;
  runningWorkflows: number;
  totalCompanies: number;
  enrichedCompanies: number;
  qualifiedCompanies: number;
  conversionRate: number;
  totalCompaniesCount: number;
  avgIpcScore: number;
  todayScrapeJobs: number;
  totalScrapeJobs: number;
  completedScrapeJobs: number;
  totalDeals: number;
  dealsValue: number;
  totalApiKeys: number;
  totalWebhooks: number;
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
    { count: qualifiedCompanies },
    { count: todayScrapeJobs },
    { count: totalScrapeJobs },
    { count: completedScrapeJobs },
    { count: totalDeals },
    { data: dealsValueData },
    { count: totalApiKeys },
    { count: totalWebhooks },
  ] = await Promise.all([
    db.from("workflows").select("*", { count: "exact", head: true }).in("status", ["active", "running"]),
    db.from("workflows").select("*", { count: "exact", head: true }).eq("status", "running"),
    db.from("companies").select("*", { count: "exact", head: true }),
    db.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true),
    db.from("companies").select("ipc_score"),
    db.from("companies").select("*", { count: "exact", head: true }).gte("ipc_score", 75),
    db.from("scrape_jobs").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    db.from("scrape_jobs").select("*", { count: "exact", head: true }),
    db.from("scrape_jobs").select("*", { count: "exact", head: true }).eq("status", "completed"),
    db.from("deals").select("*", { count: "exact", head: true }),
    db.from("deals").select("value"),
    db.from("api_keys").select("*", { count: "exact", head: true }),
    db.from("webhooks").select("*", { count: "exact", head: true }),
  ]);

  const scores = (companiesForAvg ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
  const avgIpcScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const total = totalCompanies ?? 0;
  const qualified = qualifiedCompanies ?? 0;
  const conversionRate = total > 0 ? Math.round((qualified / total) * 100) : 0;
  const dealsValue = (dealsValueData ?? []).reduce((acc, d) => acc + (Number(d.value) || 0), 0);

  return {
    activeWorkflows: activeWorkflows ?? 0,
    runningWorkflows: runningWorkflows ?? 0,
    totalCompanies: total,
    enrichedCompanies: enrichedCompanies ?? 0,
    qualifiedCompanies: qualified,
    conversionRate,
    totalCompaniesCount: total,
    avgIpcScore,
    todayScrapeJobs: todayScrapeJobs ?? 0,
    totalScrapeJobs: totalScrapeJobs ?? 0,
    completedScrapeJobs: completedScrapeJobs ?? 0,
    totalDeals: totalDeals ?? 0,
    dealsValue,
    totalApiKeys: totalApiKeys ?? 0,
    totalWebhooks: totalWebhooks ?? 0,
  };
}

export function useDashboardStats() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  useEffect(() => {
    if (!user?.id || isDemoMode) return;
    const channel = supabase
      .channel(`private:${user.id}:dashboard`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["recent-companies"] });
        queryClient.invalidateQueries({ queryKey: ["enrichment-funnel"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "workflows", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-workflows"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id, isDemoMode]);

  return useQuery({
    queryKey: ["dashboard-stats", isDemoMode],
    queryFn: isDemoMode ? () => DEMO_STATS : fetchDashboardStats,
    refetchInterval: isDemoMode ? false : 30_000,
    staleTime: isDemoMode ? Infinity : 10_000,
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
  const { isDemoMode } = useDemo();

  return useQuery({
    queryKey: ["recent-companies", limit, isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_COMPANIES.slice(0, limit)
      : async () => {
          const { data, error } = await supabase
            .from("companies")
            .select("id, name, sector, location, ipc_score, source, website, enriched")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) throw error;
          return (data ?? []) as RecentCompany[];
        },
    staleTime: isDemoMode ? Infinity : 10_000,
  });
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
}

export function useRecentActivity() {
  const { isDemoMode } = useDemo();

  return useQuery<ActivityItem[]>({
    queryKey: ["recent-activity", isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_ACTIVITY as ActivityItem[]
      : async () => {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);
          if (error) throw error;
          return (data ?? []) as ActivityItem[];
        },
    staleTime: isDemoMode ? Infinity : 10_000,
  });
}
