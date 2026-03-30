import { BarChart3, TrendingUp, Building2, Target, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const COLORS = [
  "hsl(45, 100%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(210, 80%, 60%)",
  "hsl(280, 70%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(215, 12%, 50%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass rounded-lg p-2.5 border border-border/50 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

function useAnalyticsData() {
  return useQuery({
    queryKey: ["analytics-data"],
    queryFn: async () => {
      const [
        { data: companies },
        { data: scrapeJobs },
        { data: workflows },
      ] = await Promise.all([
        supabase.from("companies").select("sector, ipc_score, enriched, source, created_at"),
        supabase.from("scrape_jobs").select("status, results_count, source, created_at"),
        supabase.from("workflows").select("status, leads_processed, leads_qualified, success_rate"),
      ]);

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

      // Source distribution for bar chart
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

      return { sectorData, sourceData, scoreData, totalCompanies, enrichedCount, avgScore, totalJobs, completedJobs, totalLeads };
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics & Relatórios
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas de desempenho de raspagem, enriquecimento e conversão
        </p>
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

        {/* Enrichment rate card */}
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
    </div>
  );
};
