import { BarChart3, TrendingUp, Building2, Target, DollarSign, Filter, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_COMPANIES_FULL, DEMO_CAMPAIGNS, DEMO_WORKFLOWS } from "@/lib/demoData";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useThemeColors } from "@/hooks/useThemeColors";
import { exportAnalyticsPDF } from "@/lib/exportAnalyticsPDF";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
const COLORS = [
  "hsl(45, 100%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(210, 80%, 60%)",
  "hsl(280, 70%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(215, 12%, 50%)",
];

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="glass rounded-lg p-2.5 border border-border/50 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

function useAnalyticsData() {
  const { isDemoMode } = useDemo();
  return useQuery({
    queryKey: ["analytics-data", isDemoMode],
    queryFn: async () => {
      let companies: any[] | null;
      let scrapeJobs: any[] | null;
      let workflows: any[] | null;
      let campaigns: any[] | null;

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
        campaigns = DEMO_CAMPAIGNS as any[];
      } else {
        const [r1, r2, r3, r4] = await Promise.all([
          supabase.from("companies").select("sector, ipc_score, enriched, source, created_at"),
          supabase.from("scrape_jobs").select("status, results_count, source, created_at"),
          supabase.from("workflows").select("status, leads_processed, leads_qualified, success_rate"),
          supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
        ]);
        companies = r1.data;
        scrapeJobs = r2.data;
        workflows = r3.data;
        campaigns = r4.data;
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

      // Conversion funnel (aggregate from all campaigns)
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

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

export const AnalyticsView = () => {
  const { data, isLoading } = useAnalyticsData();
  useThemeColors();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAnalyticsPDF();
      toast({ title: "Relatório exportado", description: "O arquivo foi baixado com sucesso." });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const d = data!;

  const summaryStats = [
    { label: "Total Empresas", value: d.totalCompanies.toLocaleString("pt-BR"), icon: Building2 },
    { label: "Enriquecidas", value: d.enrichedCount.toLocaleString("pt-BR"), icon: TrendingUp },
    { label: "Score Médio", value: `${d.avgScore}`, icon: Target },
    { label: "Raspagens", value: `${d.completedJobs}/${d.totalJobs}`, icon: BarChart3 },
  ];

  const conversionRate = d.totalProspects > 0
    ? ((d.totalMeetings / d.totalProspects) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics & Relatórios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de desempenho de raspagem, enriquecimento e conversão
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exportar Relatório
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={cardVariants} initial="hidden" animate="visible"
            className="glass rounded-lg p-4 group hover:glow-primary transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="conversao" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="conversao" className="gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" /> Conversão & ROI
          </TabsTrigger>
          <TabsTrigger value="dados" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Dados & Enriquecimento
          </TabsTrigger>
        </TabsList>

        {/* Tab: Conversion & ROI */}
        <TabsContent value="conversao" className="space-y-6">
          {/* Funnel stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {d.funnelData.map((step, i) => {
              const pct = d.totalProspects > 0 ? Math.round((step.value / d.totalProspects) * 100) : 0;
              return (
                <motion.div key={step.name} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                  className="glass rounded-lg p-3 text-center"
                >
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{step.name}</span>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">{step.value}</p>
                  <p className="text-[10px] text-muted-foreground">{pct}%</p>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Funil de Conversão
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                De prospects a reuniões — taxa geral: <span className="font-mono font-bold text-primary">{conversionRate}%</span>
              </p>
              <div className="h-[280px]">
                {d.funnelData.some((s) => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Funnel
                        dataKey="value"
                        data={d.funnelData}
                        isAnimationActive
                      >
                        <LabelList
                          position="right"
                          fill="hsl(48, 20%, 96%)"
                          fontSize={11}
                          fontFamily="JetBrains Mono, monospace"
                          formatter={(v: number) => v.toLocaleString()}
                        />
                        <LabelList
                          position="center"
                          fill="hsl(225, 30%, 3%)"
                          fontSize={10}
                          fontWeight={600}
                          dataKey="name"
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Sem dados de campanhas para exibir o funil
                  </div>
                )}
              </div>
            </motion.div>

            {/* ROI per Campaign */}
            <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                ROI por Campanha
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Taxas de abertura, resposta e conversão para reunião</p>
              <div className="h-[280px]">
                {d.roiData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.roiData} barGap={2} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} unit="%" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="abertura" fill="hsl(210, 80%, 60%)" radius={[0, 4, 4, 0]} name="Abertura %" barSize={8} />
                      <Bar dataKey="resposta" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} name="Resposta %" barSize={8} />
                      <Bar dataKey="roi" fill="hsl(45, 100%, 58%)" radius={[0, 4, 4, 0]} name="Conv. Reunião %" barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Nenhuma campanha com envios para calcular ROI
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Campaign comparison table */}
          {d.allCampaigns.length > 0 && (
            <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg overflow-hidden">
              <div className="p-5 border-b border-border/50">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Comparativo de Campanhas
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Performance detalhada por campanha</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Prospects</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Enviados</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Abertura</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Resposta</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Reuniões</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Conv. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.allCampaigns.map((c) => {
                      const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
                      const replyRate = c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0;
                      const convRate = c.prospects > 0 ? ((c.meetings / c.prospects) * 100).toFixed(1) : "0";
                      return (
                        <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                          <td className="p-3 font-medium text-foreground">{c.name}</td>
                          <td className="p-3 text-right font-mono">{c.prospects}</td>
                          <td className="p-3 text-right font-mono">{c.sent}</td>
                          <td className="p-3 text-right font-mono">{openRate}%</td>
                          <td className="p-3 text-right font-mono">{replyRate}%</td>
                          <td className="p-3 text-right font-mono font-bold text-primary">{c.meetings}</td>
                          <td className="p-3 text-right font-mono font-bold" style={{ color: Number(convRate) > 5 ? "hsl(142, 71%, 45%)" : "hsl(215, 12%, 50%)" }}>
                            {convRate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* Tab: Data & Enrichment (existing charts) */}
        <TabsContent value="dados" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Companies by source */}
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Empresas por Fonte</h3>
              <p className="text-xs text-muted-foreground mb-4">Total vs enriquecidas por fonte de dados</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.sourceData} barGap={4}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="empresas" fill="hsl(220, 14%, 20%)" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="enriquecidas" fill="hsl(45, 100%, 58%)" radius={[4, 4, 0, 0]} name="Enriquecidas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Score distribution */}
            <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição de Score IPC</h3>
              <p className="text-xs text-muted-foreground mb-4">Quantidade de empresas por faixa de score</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.scoreData} layout="vertical" barSize={20}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="range" type="category" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(45, 100%, 58%)" radius={[0, 4, 4, 0]} name="Empresas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Sector distribution */}
            <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição por Setor</h3>
              <p className="text-xs text-muted-foreground mb-4">Percentual de empresas por setor</p>
              <div className="flex items-center gap-6">
                <div className="h-[180px] w-[180px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={d.sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {d.sectorData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                  {d.sectorData.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-muted-foreground truncate">{s.name}</span>
                      <span className="font-mono font-bold text-foreground ml-auto">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Enrichment rate */}
            <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5 flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-foreground mb-1">Taxa de Enriquecimento</h3>
              <p className="text-xs text-muted-foreground mb-6">Percentual de empresas com dados completos</p>
              <div className="flex items-center justify-center">
                <div className="relative h-32 w-32">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(d.totalCompanies > 0 ? (d.enrichedCount / d.totalCompanies) : 0) * 326.73} 326.73`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {d.totalCompanies > 0 ? Math.round((d.enrichedCount / d.totalCompanies) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                {d.enrichedCount.toLocaleString()} de {d.totalCompanies.toLocaleString()} empresas enriquecidas
              </p>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
