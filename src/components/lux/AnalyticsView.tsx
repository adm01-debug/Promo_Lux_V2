import { BarChart3, TrendingUp, Building2, Target, FileDown, Loader2, Filter } from "lucide-react";
import { DataError } from "@/components/lux/DataError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useThemeColors } from "@/hooks/useThemeColors";
import { exportAnalyticsPDF } from "@/lib/exportAnalyticsPDF";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { AnimatedCounter } from "./analytics/AnimatedCounter";
import { useAnalyticsData } from "./analytics/useAnalyticsData";
import { ConversionTab } from "./analytics/ConversionTab";
import { DataEnrichmentTab } from "./analytics/DataEnrichmentTab";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

export const AnalyticsView = () => {
  const { data, isLoading, error, refetch } = useAnalyticsData();
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
        <div><Skeleton className="h-7 w-64 mb-2" /><Skeleton className="h-4 w-96" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) return <DataError message={error.message} onRetry={() => refetch()} />;

  const d = data!;

  const summaryStats = [
    { label: "Total Empresas", rawValue: d.totalCompanies, suffix: "", icon: Building2 },
    { label: "Enriquecidas", rawValue: d.enrichedCount, suffix: "", icon: TrendingUp },
    { label: "Score Médio", rawValue: d.avgScore, suffix: "", icon: Target },
    { label: "Raspagens", value: `${d.completedJobs}/${d.totalJobs}`, rawValue: undefined, suffix: "", icon: BarChart3 },
  ];

  const conversionRate = d.totalProspects > 0
    ? ((d.totalMeetings / d.totalProspects) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analytics & Relatórios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Métricas de desempenho de raspagem, enriquecimento e conversão</p>
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
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            className="glass rounded-lg p-4 group hover:glow-primary transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">{stat.label}</span>
              <motion.div whileHover={{ rotate: 8, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                <stat.icon className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" />
              </motion.div>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {stat.rawValue !== undefined ? <AnimatedCounter value={stat.rawValue} suffix={stat.suffix} /> : stat.value}
            </p>
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

        <TabsContent value="conversao" className="space-y-6">
          <ConversionTab
            funnelData={d.funnelData}
            roiData={d.roiData}
            allCampaigns={d.allCampaigns}
            totalProspects={d.totalProspects}
            totalMeetings={d.totalMeetings}
            conversionRate={conversionRate}
          />
        </TabsContent>

        <TabsContent value="dados" className="space-y-6">
          <DataEnrichmentTab
            sourceData={d.sourceData}
            scoreData={d.scoreData}
            sectorData={d.sectorData}
            totalCompanies={d.totalCompanies}
            enrichedCount={d.enrichedCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
