import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_COMPANIES_FULL, DEMO_CAMPAIGNS, DEMO_WORKFLOWS } from "@/lib/demoData";
import { COLORS } from "./AnalyticsChartTooltip";

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

export function useAnalyticsData() {
  const { isDemoMode } = useDemo();
  return useQuery({
    queryKey: ["analytics-data", isDemoMode],
    queryFn: async () => {
      let companies: AnalyticsCompany[] | null;
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
        const [r1, r2, r3, r4] = await Promise.all([
          db.from("companies").select("sector, ipc_score, enriched, source, created_at"),
          db.from("scrape_jobs").select("status, results_count, source, created_at"),
          db.from("workflows").select("status, leads_processed, leads_qualified, success_rate"),
          db.from("campaigns").select("*").order("created_at", { ascending: false }),
        ]);
        companies = r1.data as AnalyticsCompany[] | null;
        scrapeJobs = r2.data as AnalyticsScrapeJob[] | null;
        workflows = r3.data as AnalyticsWorkflow[] | null;
        campaigns = r4.data as unknown as AnalyticsCampaign[] | null;
      }

      // Sector distribution
      const sectorMap = new Map<string, number>();
      (companies ?? []).forEach((c) => {
        const sector = c.sector ?? "Outros";
        sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
      });
      const total = companies?.length || 1;
      const sectorData = Array.from(sectorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({
          name,
          value: Math.round((value / total) * 100),
          color: COLORS[i % COLORS.length],
        }));

      // Source distribution
      const sourceMap = new Map<string, { total: number; enriched: number }>();
      (companies ?? []).forEach((c) => {
        const src = c.source ?? "manual";
        const existing = sourceMap.get(src) || { total: 0, enriched: 0 };
        existing.total++;
        if (c.enriched) existing.enriched++;
        sourceMap.set(src, existing);
      });
      const sourceData = Array.from(sourceMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 7)
        .map(([name, { total: t, enriched }]) => ({
          name: name.length > 12 ? name.slice(0, 12) + "…" : name,
          empresas: t,
          enriquecidas: enriched,
        }));

      // Score distribution
      const scoreRanges = [
        { range: "90-100", min: 90, max: 100 },
        { range: "75-89", min: 75, max: 89 },
        { range: "60-74", min: 60, max: 74 },
        { range: "< 60", min: 0, max: 59 },
      ];
      const scoreData = scoreRanges.map((r) => ({
        range: r.range,
        count: (companies ?? []).filter((c) => (c.ipc_score ?? 0) >= r.min && (c.ipc_score ?? 0) <= r.max).length,
      }));

      // Summary stats
      const totalCompanies = companies?.length ?? 0;
      const enrichedCount = (companies ?? []).filter((c) => c.enriched).length;
      const scores = (companies ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
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
      };
    },
    staleTime: 30_000,
  });
}
