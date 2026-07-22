import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import { useDemo } from "@/contexts/demo-context";
import { useActiveOrganization } from "@/hooks/useOrganizations";
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

async function fetchDashboardStats(orgId: string): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats", { p_org_id: orgId });
  if (error) throw error;
  
  const stats = data as Record<string, number>;
  return {
    activeWorkflows: stats.activeWorkflows ?? 0,
    runningWorkflows: stats.runningWorkflows ?? 0,
    totalCompanies: stats.totalCompanies ?? 0,
    enrichedCompanies: stats.enrichedCompanies ?? 0,
    qualifiedCompanies: stats.qualifiedCompanies ?? 0,
    conversionRate: stats.totalCompanies > 0 ? Math.round((stats.qualifiedCompanies / stats.totalCompanies) * 100) : 0,
    totalCompaniesCount: stats.totalCompanies ?? 0,
    avgIpcScore: stats.avgIpcScore ?? 0,
    todayScrapeJobs: stats.todayScrapeJobs ?? 0,
    totalScrapeJobs: stats.totalScrapeJobs ?? 0,
    completedScrapeJobs: stats.completedScrapeJobs ?? 0,
    totalDeals: stats.totalDeals ?? 0,
    dealsValue: stats.dealsValue ?? 0,
    totalApiKeys: stats.totalApiKeys ?? 0,
    totalWebhooks: stats.totalWebhooks ?? 0,
  };
}

export function useDashboardStats() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (!user?.id || isDemoMode || !activeOrgId) return;

    // Rodada #27: dashboard stale após DELETE — `payload.new` é undefined
    // em eventos DELETE (Postgres/PostgREST só entrega `old` conforme
    // REPLICA IDENTITY), então o filtro `payload.new.organization_id`
    // nunca casava e a UI ficava com contagem defasada. Também incluímos
    // `activeOrgId` no nome do canal para que trocas de org rasguem
    // completamente as subscriptions antigas, evitando invalidação
    // cross-org no intervalo entre desmontar/reassinar.
    const orgOf = (payload: { new?: unknown; old?: unknown }) => {
      const src = (payload.new ?? payload.old) as { organization_id?: string } | undefined;
      return src?.organization_id;
    };

    const channel = supabase
      .channel(`private:${user.id}:${activeOrgId}:dashboard`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          if (orgOf(payload) !== activeOrgId) return;
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["recent-companies"] });
          queryClient.invalidateQueries({ queryKey: ["enrichment-funnel"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflows", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          if (orgOf(payload) !== activeOrgId) return;
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-workflows"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          if (orgOf(payload) !== activeOrgId) return;
          queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          if (orgOf(payload) !== activeOrgId) return;
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id, isDemoMode, activeOrgId]);

  return useQuery({
    queryKey: ["dashboard-stats", isDemoMode, activeOrgId],
    queryFn: isDemoMode 
      ? () => DEMO_STATS 
      : () => fetchDashboardStats(activeOrgId || ""),
    enabled: isDemoMode || !!activeOrgId,
    refetchInterval: isDemoMode ? false : 60_000,
    staleTime: isDemoMode ? Infinity : 30_000,
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
  cnpj: string | null;
}

export function useRecentCompanies(limit = 6) {
  const { isDemoMode } = useDemo();

  return useQuery({
    queryKey: ["recent-companies", limit, isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_COMPANIES.slice(0, limit)
      : async () => {
          const { data, error } = await db
            .from("companies")
            .select("id, name, sector, location, ipc_score, source, website, enriched, cnpj")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) throw error;
          return (data ?? []) as RecentCompany[];
        },
    staleTime: isDemoMode ? Infinity : 30_000,
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
          // Projeção explícita — evita puxar metadata JSONB pesado desnecessariamente.
          const { data, error } = await db
            .from("notifications")
            .select("id, type, title, message, created_at, read, metadata")
            .order("created_at", { ascending: false })
            .limit(10);
          if (error) throw error;
          return (data ?? []) as ActivityItem[];
        },
    staleTime: isDemoMode ? Infinity : 30_000,
  });
}
