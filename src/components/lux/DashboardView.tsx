import { StatsGrid } from "@/components/lux/StatsGrid";
import { AutomationsList } from "@/components/lux/AutomationsList";
import { CompanyTable } from "@/components/lux/CompanyTable";
import { ActivityFeed } from "@/components/lux/ActivityFeed";
import { EnrichmentFunnel } from "@/components/lux/EnrichmentFunnel";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";

const performanceData = [
  { day: "Seg", raspadas: 120, qualificadas: 85 },
  { day: "Ter", raspadas: 210, qualificadas: 142 },
  { day: "Qua", raspadas: 180, qualificadas: 120 },
  { day: "Qui", raspadas: 340, qualificadas: 245 },
  { day: "Sex", raspadas: 280, qualificadas: 198 },
  { day: "Sáb", raspadas: 150, qualificadas: 95 },
  { day: "Dom", raspadas: 90, qualificadas: 62 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 border border-border/50 shadow-xl">
        <p className="text-xs font-medium text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-[11px]" style={{ color: p.color }}>
            {p.dataKey === "raspadas" ? "Raspadas" : "Qualificadas"}: <span className="font-mono font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface DashboardViewProps {
  onNavigate?: (view: string) => void;
}

export const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  const colors = useThemeColors();

  const gridColor = colors.border;
  const axisColor = colors.mutedFg;
  const primaryStroke = colors.primary;
  const successStroke = colors.success;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das automações e empresas identificadas pelo IPC
          </p>
        </div>
        <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Últimos 7 dias
        </div>
      </div>

      <StatsGrid onNavigate={onNavigate} />

      {/* Performance chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Performance Semanal
            </h3>
            <p className="text-xs text-muted-foreground">Empresas raspadas vs qualificadas</p>
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="gradientRaspadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryStroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={primaryStroke} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientQualificadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={successStroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={successStroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="day" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="raspadas" stroke={primaryStroke} fill="url(#gradientRaspadas)" strokeWidth={2} />
              <Area type="monotone" dataKey="qualificadas" stroke={successStroke} fill="url(#gradientQualificadas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <EnrichmentFunnel />
        </div>
        <div className="xl:col-span-2">
          <AutomationsList />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <CompanyTable />
        </div>
        <div className="xl:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};
