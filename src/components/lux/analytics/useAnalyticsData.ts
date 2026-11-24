import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useDemo } from "@/contexts/demo-context";
import { DEMO_COMPANIES_FULL, DEMO_CAMPAIGNS, DEMO_WORKFLOWS } from "@/lib/demoData";
import { COLORS } from "./analytics-constants";
import { useActiveOrganization } from "@/contexts/active-org-context";

/** Campos de campanha consumidos pelos gráficos de conversão/ROI. */
export interface AnalyticsCampaign {
  id: string;
  name: string;
  prospects: number;
  sent: number;
  opened: number;
  replied: number;
  meetings: number;
}
interface AnalyticsCompany {
  sector: string | null;
  ipc_score: number | null;
  enriched: boolean | null;
  source: string | null;
  created_at: string;
}
interface AnalyticsScrapeJob {
  status: string;
  results_count: number | null;
  source: string | null;
  created_at: string;
}
interface AnalyticsWorkflow {
  status: string;
  leads_processed: number | null;
  leads_qualified: number | null;
  success_rate: number | null;
}

/** Linhas devolvidas por company_analytics_summary(_org_id). */
interface CompanySummary {
  total_companies: number | string | null;
  enriched_companies: number | string | null;
  enriched_pct: number | string | null;
  avg_ipc: number | string | null;
  with_email: number | string | null;
  with_phone: number | string | null;
  with_website: number | string | null;
  top_sector: string | null;
}
interface CompanyIpcBucket { bucket: string; bucket_pos: number; total: number | string | null }
interface CompanySourceRow { source: string; total: number | string | null; enriched: number | string | null }
interface CompanySectorRow { sector: string; total: number | string | null; pct: number | string | null }
interface CompanyGrowthRow { month_start: string; new_companies: number | string | null; enriched_companies: number | string | null }

/** numeric do Postgres chega como string no PostgREST. */
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export interface AnalyticsGrowthPoint {
  month: string;
  novas: number;
  enriquecidas: number;
}

export function useAnalyticsData() {
  const { isDemoMode } = useDemo();
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["analytics-data", isDemoMode, activeOrgId],
    queryFn: async () => {
      let companies: AnalyticsCompany[] | null = null;
      let aggSummary: CompanySummary | null = null;
      let aggScore: { range: string; count: number }[] = [];
      let aggSource: { name: string; empresas: number; enriquecidas: number }[] = [];
      let aggSector: { name: string; value: number; color: string }[] = [];
      let aggGrowth: { month: string; novas: number; enriquecidas: number }[] = [];
      let scrapeJobs: AnalyticsScrapeJob[] | null;
      let workflows: AnalyticsWorkflow[] | null;
      let campaigns: AnalyticsCampaign[] | null;

      if (isDemoMode) {
        companies = DEMO_COMPANIES_FULL.map(c => ({ sector: c.sector, ipc_score: c.ipcScore, enriched: c.enriched, source: c.source, created_at: new Date().toISOString() }));
        scrapeJobs = [
          { status: "completed", results_count: 87, source: "gmaps", created_at: new Date().toISOString() },
          { status: "completed", results_count: 43, source: "gmaps", created_at: new Date().toISOString() },
          { status: "running", results_count: 31, source: "gmaps", created_at: new Date().toISOString() },
          { status: "completed", results_count: 22, source: "gmaps", created_at: new Date().toISOString() },
          { status: "pending", results_count: 0, source: "gmaps", created_at: new Date().toISOString() },
        ];
        workflows = DEMO_WORKFLOWS.map(w => ({ status: w.status, leads_processed: w.leads_processed, leads_qualified: w.leads_qualified, success_rate: w.success_rate }));
        campaigns = DEMO_CAMPAIGNS as unknown as AnalyticsCampaign[];
      } else {
        // Agregacao no servidor: sem isso o PostgREST trunca a resposta em
        // max_rows (1000) e os totais de uma org grande saem subestimados.
        // A tabela companies nao e mais baixada inteira — H37.
        const org = activeOrgId;
        if (!org) throw new Error("Organizacao ativa nao definida");
        const [r1, r2, r3, r4] = await Promise.all([
          supabase.rpc("company_analytics_summary", { _org_id: org }),
          supabase.rpc("company_ipc_distribution", { _org_id: org }),
          supabase.rpc("company_source_distribution", { _org_id: org, _limit: 7 }),
          supabase.rpc("company_sector_distribution", { _org_id: org, _limit: 6 }),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
        if (r3.error) throw r3.error;
        if (r4.error) throw r4.error;

        const summary = ((r1.data ?? []) as CompanySummary[])[0];
        const ipc = (r2.data ?? []) as CompanyIpcBucket[];
        const sources = (r3.data ?? []) as CompanySourceRow[];
        const sectors = (r4.data ?? []) as CompanySectorRow[];

        aggSummary = summary ?? null;
        aggScore = ipc.map((b) => ({ range: b.bucket, count: num(b.total) }));
        aggSource = sources.map((r) => ({
          name: r.source.length > 12 ? r.source.slice(0, 12) + "…" : r.source,
          empresas: num(r.total),
          enriquecidas: num(r.enriched),
        }));
        aggSector = sectors.map((r, i) => ({
          name: r.sector,
          value: Math.round(num(r.pct)),
          color: COLORS[i % COLORS.length],
        }));

        const growth = await supabase.rpc("company_growth_trend", { _org_id: org, _months: 6 });
        if (!growth.error) {
          aggGrowth = ((growth.data ?? []) as CompanyGrowthRow[]).map((g) => ({
            month: g.month_start,
            novas: num(g.new_companies),
            enriquecidas: num(g.enriched_companies),
          }));
        }

        const [r5, r6, r7] = await Promise.all([
          db.from("scrape_jobs").select("status, results_count, source, created_at"),
          db.from("workflows").select("status, leads_processed, leads_qualified, success_rate"),
          db.from("campaigns").select("*").order("created_at", { ascending: false }),
        ]);
        scrapeJobs = r5.data as AnalyticsScrapeJob[] | null;
        workflows = r6.data as AnalyticsWorkflow[] | null;
        campaigns = r7.data as unknown as AnalyticsCampaign[] | null;
      }

      // Sector distribution — em producao vem de company_sector_distribution()
      let sectorData = aggSector;
      if (isDemoMode) {
        const sectorMap = new Map<string, number>();
        (companies ?? []).forEach((c) => {
          const sector = c.sector ?? "Outros";
          sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
        });
        const total = companies?.length || 1;
        sectorData = Array.from(sectorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, value], i) => ({
            name,
            value: Math.round((value / total) * 100),
            color: COLORS[i % COLORS.length],
          }));
      }

      // Source distribution — em producao vem de company_source_distribution()
      let sourceData = aggSource;
      if (isDemoMode) {
        const sourceMap = new Map<string, { total: number; enriched: number }>();
        (companies ?? []).forEach((c) => {
          const src = c.source ?? "manual";
          const existing = sourceMap.get(src) || { total: 0, enriched: 0 };
          existing.total++;
          if (c.enriched) existing.enriched++;
          sourceMap.set(src, existing);
        });
        sourceData = Array.from(sourceMap.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 7)
          .map(([name, { total: t, enriched }]) => ({
            name: name.length > 12 ? name.slice(0, 12) + "…" : name,
            empresas: t,
            enriquecidas: enriched,
          }));
      }

      // Score distribution — em producao vem de company_ipc_distribution()
      let scoreData = aggScore;
      if (isDemoMode) {
        const scoreRanges = [
          { range: "90-100", min: 90, max: 100 },
          { range: "75-89", min: 75, max: 89 },
          { range: "60-74", min: 60, max: 74 },
          { range: "< 60", min: 0, max: 59 },
        ];
        scoreData = scoreRanges.map((r) => ({
          range: r.range,
          count: (companies ?? []).filter((c) => (c.ipc_score ?? 0) >= r.min && (c.ipc_score ?? 0) <= r.max).length,
        }));
      }

      // Summary stats — em producao vem de company_analytics_summary()
      let totalCompanies: number;
      let enrichedCount: number;
      let avgScore: number;
      if (isDemoMode) {
        totalCompanies = companies?.length ?? 0;
        enrichedCount = (companies ?? []).filter((c) => c.enriched).length;
        const scores = (companies ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
        avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      } else {
        totalCompanies = num(aggSummary?.total_companies);
        enrichedCount = num(aggSummary?.enriched_companies);
        avgScore = Math.round(num(aggSummary?.avg_ipc));
      }
      const totalJobs = scrapeJobs?.length ?? 0;
      const completedJobs = (scrapeJobs ?? []).filter((j) => j.status === "completed").length;
      const totalLeads = (workflows ?? []).reduce((a, w) => a + (w.leads_processed ?? 0), 0);

      // Conversion funnel
      const allCampaigns = campaigns ?? [];
      const totalProspects = allCampaigns.reduce((a, c) => a + (c.prospects || 0), 0);
      const totalSent = allCampaigns.reduce((a, c) => a + (c.sent || 0), 0);
      const totalOpened = allCampaigns.reduce((a, c) => a + (c.opened || 0), 0);
      const totalReplied = allCampaigns.reduce((a, c) => a + (c.replied || 0), 0);
      const totalMeetings = allCampaigns.reduce((a, c) => a + (c.meetings || 0), 0);

      const funnelData = [
        { name: "Prospects", value: totalProspects, fill: "hsl(210, 80%, 60%)" },
        { name: "Enviados", value: totalSent, fill: "hsl(45, 100%, 58%)" },
        { name: "Abertos", value: totalOpened, fill: "hsl(280, 70%, 55%)" },
        { name: "Respondidos", value: totalReplied, fill: "hsl(142, 71%, 45%)" },
        { name: "Reuniões", value: totalMeetings, fill: "hsl(340, 70%, 55%)" },
      ];

      // ROI per campaign
      const roiData = allCampaigns
        .filter((c) => c.sent > 0)
        .slice(0, 8)
        .map((c) => ({
          name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
          abertura: c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0,
          resposta: c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0,
          reunioes: c.meetings || 0,
          roi: c.prospects > 0 ? Math.round((c.meetings / c.prospects) * 100) : 0,
        }));

      return {
        sectorData, sourceData, scoreData,
        totalCompanies, enrichedCount, avgScore,
        totalJobs, completedJobs, totalLeads,
        funnelData, roiData, allCampaigns,
        totalProspects, totalSent, totalOpened, totalReplied, totalMeetings,
        growthData: aggGrowth,
      };
    },
    staleTime: 30_000,
  });
}
