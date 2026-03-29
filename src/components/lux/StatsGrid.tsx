import { Activity, Zap, Building2, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  progress?: number;
}

const StatCard = ({ title, value, subtitle, icon, trend, trendUp = true, progress }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-lg p-5 group hover:glow-primary transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-3">
      <span className="text-muted-foreground text-xs uppercase tracking-widest">{title}</span>
      <div className="text-primary/70 group-hover:text-primary transition-colors">{icon}</div>
    </div>
    <p className="text-3xl font-bold text-foreground tracking-tight font-mono">{value}</p>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-muted-foreground text-sm">{subtitle}</span>
      {trend && (
        <span className={`text-xs font-medium flex items-center gap-0.5 ${trendUp ? "text-success" : "text-destructive"}`}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
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

export const StatsGrid = () => {
  const stats: StatCardProps[] = [
    {
      title: "Automações Ativas",
      value: 12,
      subtitle: "3 em execução agora",
      icon: <Zap className="h-5 w-5" />,
      trend: "+2 hoje",
      trendUp: true,
    },
    {
      title: "Empresas Encontradas",
      value: "1.847",
      subtitle: "Últimas 24h",
      icon: <Building2 className="h-5 w-5" />,
      trend: "+324",
      trendUp: true,
    },
    {
      title: "Taxa de Match IPC",
      value: "73%",
      subtitle: "Acima da média",
      icon: <TrendingUp className="h-5 w-5" />,
      trend: "+5%",
      trendUp: true,
      progress: 73,
    },
    {
      title: "Raspagens Hoje",
      value: "48/60",
      subtitle: "80% concluído",
      icon: <Activity className="h-5 w-5" />,
      progress: 80,
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
