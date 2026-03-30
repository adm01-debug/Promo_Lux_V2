import { useState, useCallback, useMemo } from "react";
import { Responsive, Layout } from "react-grid-layout";
import WidthProvider from "react-grid-layout/lib/components/WidthProvider";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { StatsGrid } from "@/components/lux/StatsGrid";
import { AutomationsList } from "@/components/lux/AutomationsList";
import { CompanyTable } from "@/components/lux/CompanyTable";
import { ActivityFeed } from "@/components/lux/ActivityFeed";
import { EnrichmentFunnel } from "@/components/lux/EnrichmentFunnel";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Lock, Unlock, RotateCcw, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";

const ResponsiveGridLayout = WidthProvider(Responsive);

const LAYOUT_KEY = "lux-dashboard-layout";

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

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "stats", x: 0, y: 0, w: 12, h: 3, isResizable: false },
    { i: "chart", x: 0, y: 3, w: 12, h: 6 },
    { i: "funnel", x: 0, y: 9, w: 4, h: 7 },
    { i: "automations", x: 4, y: 9, w: 8, h: 7 },
    { i: "companies", x: 0, y: 16, w: 8, h: 8 },
    { i: "activity", x: 8, y: 16, w: 4, h: 8 },
  ],
  md: [
    { i: "stats", x: 0, y: 0, w: 10, h: 3, isResizable: false },
    { i: "chart", x: 0, y: 3, w: 10, h: 6 },
    { i: "funnel", x: 0, y: 9, w: 4, h: 7 },
    { i: "automations", x: 4, y: 9, w: 6, h: 7 },
    { i: "companies", x: 0, y: 16, w: 6, h: 8 },
    { i: "activity", x: 6, y: 16, w: 4, h: 8 },
  ],
  sm: [
    { i: "stats", x: 0, y: 0, w: 6, h: 3, isResizable: false },
    { i: "chart", x: 0, y: 3, w: 6, h: 6 },
    { i: "funnel", x: 0, y: 9, w: 6, h: 6 },
    { i: "automations", x: 0, y: 15, w: 6, h: 7 },
    { i: "companies", x: 0, y: 22, w: 6, h: 8 },
    { i: "activity", x: 0, y: 30, w: 6, h: 7 },
  ],
};

function loadLayouts(): Layouts {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_LAYOUTS;
}

function saveLayouts(layouts: Layouts) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts));
  } catch {}
}

interface WidgetWrapperProps {
  title: string;
  editing: boolean;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const WidgetWrapper = ({ title, editing, children, className, noPadding }: WidgetWrapperProps) => (
  <div className={cn(
    "h-full glass rounded-lg overflow-hidden flex flex-col",
    editing && "ring-1 ring-primary/20 ring-offset-1 ring-offset-background",
    className
  )}>
    {editing && (
      <div className="drag-handle flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-border/30 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="h-3.5 w-3.5 text-primary/50" />
        <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wider">{title}</span>
      </div>
    )}
    <div className={cn("flex-1 overflow-auto", !noPadding && "p-0")}>
      {children}
    </div>
  </div>
);

interface DashboardViewProps {
  onNavigate?: (view: string) => void;
}

export const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>(loadLayouts);

  const handleLayoutChange = useCallback((_: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    saveLayouts(allLayouts);
  }, []);

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    saveLayouts(DEFAULT_LAYOUTS);
  }, []);

  const gridColor = colors.border;
  const axisColor = colors.mutedFg;
  const primaryStroke = colors.primary;
  const successStroke = colors.success;

  return (
    <div className="space-y-4">
      {/* Header */}
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
            {editing ? "Salvar Layout" : "Editar Layout"}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={resetLayout}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Grid layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 0 }}
        cols={{ lg: 12, md: 10, sm: 6 }}
        rowHeight={40}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".drag-handle"
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        margin={[16, 16]}
      >
        <div key="stats">
          <WidgetWrapper title="Estatísticas" editing={editing}>
            <StatsGrid onNavigate={onNavigate} />
          </WidgetWrapper>
        </div>

        <div key="chart">
          <WidgetWrapper title="Performance" editing={editing}>
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Performance Semanal
                </h3>
                <p className="text-xs text-muted-foreground">Empresas raspadas vs qualificadas</p>
              </div>
            </div>
            <div className="p-5 flex-1">
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
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
          </WidgetWrapper>
        </div>

        <div key="funnel">
          <WidgetWrapper title="Funil de Enriquecimento" editing={editing}>
            <EnrichmentFunnel />
          </WidgetWrapper>
        </div>

        <div key="automations">
          <WidgetWrapper title="Automações" editing={editing}>
            <AutomationsList />
          </WidgetWrapper>
        </div>

        <div key="companies">
          <WidgetWrapper title="Empresas" editing={editing}>
            <CompanyTable />
          </WidgetWrapper>
        </div>

        <div key="activity">
          <WidgetWrapper title="Atividade" editing={editing}>
            <ActivityFeed />
          </WidgetWrapper>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};
