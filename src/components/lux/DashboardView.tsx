import { useState, useCallback } from "react";
import { StatsGrid } from "@/components/lux/StatsGrid";
import { AutomationsList } from "@/components/lux/AutomationsList";
import { CompanyTable } from "@/components/lux/CompanyTable";
import { ActivityFeed } from "@/components/lux/ActivityFeed";
import { EnrichmentFunnel } from "@/components/lux/EnrichmentFunnel";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Lock, Unlock, RotateCcw, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useWeeklyPerformance } from "@/hooks/useWeeklyPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LAYOUT_KEY = "lux-dashboard-widget-order";

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

type WidgetId = "chart" | "funnel-automations" | "companies-activity";

const DEFAULT_ORDER: WidgetId[] = ["chart", "funnel-automations", "companies-activity"];

function loadOrder(): WidgetId[] {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_ORDER;
}

interface DashboardViewProps {
  onNavigate?: (view: string) => void;
}

export const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  const colors = useThemeColors();
  const { data: performanceData = [], isLoading: perfLoading } = useWeeklyPerformance();
  const [editing, setEditing] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(loadOrder);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const gridColor = colors.border;
  const axisColor = colors.mutedFg;
  const primaryStroke = colors.primary;
  const successStroke = colors.success;

  const handleDragStart = useCallback((idx: number) => {
    setDragging(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOver(idx);
  }, []);

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragging === null || dragging === targetIdx) {
      setDragOver(null);
      setDragging(null);
      return;
    }
    setWidgetOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragging, 1);
      next.splice(targetIdx, 0, moved);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      return next;
    });
    setDragOver(null);
    setDragging(null);
  }, [dragging]);

  const resetOrder = useCallback(() => {
    setWidgetOrder(DEFAULT_ORDER);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(DEFAULT_ORDER));
  }, []);

  const widgets: Record<WidgetId, { title: string; content: React.ReactNode }> = {
    chart: {
      title: "Performance Semanal",
      content: (
        <div className="glass rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance Semanal
              </h3>
              <p className="text-xs text-muted-foreground">Empresas raspadas vs qualificadas (últimos 7 dias — dados reais)</p>
            </div>
          </div>
          <div className="p-5">
            {perfLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : (
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
            )}
          </div>
        </div>
      ),
    },
    "funnel-automations": {
      title: "Funil & Automações",
      content: (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <EnrichmentFunnel />
          </div>
          <div className="xl:col-span-2">
            <AutomationsList />
          </div>
        </div>
      ),
    },
    "companies-activity": {
      title: "Empresas & Atividade",
      content: (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <CompanyTable />
          </div>
          <div className="xl:col-span-1">
            <ActivityFeed />
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das automações e empresas identificadas pelo IPC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Últimos 7 dias
          </div>
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {editing ? "Salvar" : "Editar Layout"}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={resetOrder}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <StatsGrid onNavigate={onNavigate} />

      {widgetOrder.map((id, idx) => {
        const widget = widgets[id];
        return (
          <motion.div
            key={id}
            layout={editing}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.08 }}
            draggable={editing}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={() => { setDragOver(null); setDragging(null); }}
            onDrop={() => handleDrop(idx)}
            className={cn(
              "relative transition-all",
              editing && "cursor-grab active:cursor-grabbing",
              dragOver === idx && dragging !== idx && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-lg",
              dragging === idx && "opacity-50"
            )}
          >
            {editing && (
              <div className="absolute -top-2 left-4 z-10 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
                <GripVertical className="h-3 w-3 text-primary/60" />
                <span className="text-[9px] font-medium text-primary/80 uppercase tracking-wider">{widget.title}</span>
              </div>
            )}
            {widget.content}
          </motion.div>
        );
      })}
    </div>
  );
};
