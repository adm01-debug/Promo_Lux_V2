import { Activity, Zap, Building2, TrendingUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
}

const StatCard = ({ title, value, subtitle, icon, trend }: StatCardProps) => (
  <div className="glass rounded-lg p-5 group hover:glow-primary transition-all duration-300">
    <div className="flex items-start justify-between mb-3">
      <span className="text-muted-foreground text-xs uppercase tracking-widest">{title}</span>
      <div className="text-primary/70 group-hover:text-primary transition-colors">{icon}</div>
    </div>
    <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-muted-foreground text-sm">{subtitle}</span>
      {trend && <span className="text-xs text-success font-medium">{trend}</span>}
    </div>
  </div>
);

export const StatsGrid = () => {
  const stats: StatCardProps[] = [
    {
      title: "Automações Ativas",
      value: 12,
      subtitle: "3 em execução agora",
      icon: <Zap className="h-5 w-5" />,
      trend: "+2 hoje",
    },
    {
      title: "Empresas Encontradas",
      value: "1.847",
      subtitle: "Últimas 24h",
      icon: <Building2 className="h-5 w-5" />,
      trend: "+324",
    },
    {
      title: "Taxa de Match IPC",
      value: "73%",
      subtitle: "Acima da média",
      icon: <TrendingUp className="h-5 w-5" />,
      trend: "+5%",
    },
    {
      title: "Raspagens Hoje",
      value: 48,
      subtitle: "de 60 planejadas",
      icon: <Activity className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
};
