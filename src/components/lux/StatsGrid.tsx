import { Activity, Zap, Building2, TrendingUp, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardStats } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  progress?: number;
  onClick?: () => void;
  featured?: boolean;
}

const StatCard = ({ title, value, subtitle, icon, trend, trendUp = true, progress, onClick, featured }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={cn(
      "glass rounded-lg p-5 group transition-all duration-300",
      onClick && "cursor-pointer",
      featured
        ? "border-primary/40 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.35)]"
        : "hover:glow-primary"
    )}
  >
    <div className="flex items-start justify-between mb-3">
      <span className={cn(
        "text-xs uppercase tracking-widest",
        featured ? "text-primary font-semibold" : "text-muted-foreground"
      )}>{title}</span>
      <div className={cn(
        "transition-colors",
        featured ? "text-primary" : "text-primary/70 group-hover:text-primary"
      )}>{icon}</div>
    </div>
    <p className={cn(
      "font-bold text-foreground tracking-tight font-mono",
      featured ? "text-4xl" : "text-3xl"
    )}>{value}</p>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-muted-foreground text-sm">{subtitle}</span>
      {trend && (
        <span className="text-xs font-medium flex items-center gap-0.5 text-success">
          <ArrowUpRight className="h-3 w-3" />
          {trend}
        </span>
      )}
    </div>
    {progress !== undefined && (
      <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, delay: 0.3 }}
        />
      </div>
    )}
  </motion.div>
);

const StatSkeleton = () => (
  <div className="glass rounded-lg p-5 space-y-3">
    <div className="flex items-start justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-5 rounded" />
    </div>
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-3 w-32" />
  </div>
);

interface StatsGridProps {
  onNavigate?: (view: string) => void;
}

export const StatsGrid = ({ onNavigate }: StatsGridProps) => {
  const { data, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  const s = data!;
  const matchRate = s.totalCompanies > 0 ? Math.round((s.enrichedCompanies / s.totalCompanies) * 100) : 0;
  const scrapeProgress = s.totalScrapeJobs > 0 ? Math.round((s.completedScrapeJobs / s.totalScrapeJobs) * 100) : 0;

  const stats: StatCardProps[] = [
    {
      title: "Workflows Ativos",
      value: s.activeWorkflows,
      subtitle: `${s.runningWorkflows} em execução agora`,
      icon: <Zap className="h-5 w-5" />,
      onClick: () => onNavigate?.("workflows"),
    },
    {
      title: "Empresas Encontradas",
      value: s.totalCompanies.toLocaleString("pt-BR"),
      subtitle: `${s.enrichedCompanies} enriquecidas`,
      icon: <Building2 className="h-5 w-5" />,
      featured: true,
      onClick: () => onNavigate?.("companies"),
    },
    {
      title: "Taxa de Enriquecimento",
      value: `${matchRate}%`,
      subtitle: matchRate >= 50 ? "Acima da média" : "Abaixo da média",
      icon: <TrendingUp className="h-5 w-5" />,
      progress: matchRate,
      onClick: () => onNavigate?.("companies"),
    },
    {
      title: "Raspagens Hoje",
      value: `${s.todayScrapeJobs}`,
      subtitle: `${scrapeProgress}% concluído`,
      icon: <Activity className="h-5 w-5" />,
      progress: scrapeProgress,
      onClick: () => onNavigate?.("gmaps"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div key={stat.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
          <StatCard {...stat} />
        </motion.div>
      ))}
    </div>
  );
};
