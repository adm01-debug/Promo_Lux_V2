import { useMemo } from "react";
import { useDbHealth, computeAlerts, type AlertSeverity } from "@/hooks/useDbHealth";
import { DlqHealthCard } from "./DlqHealthCard";
import { DlqAlertSettingsCard } from "./DlqAlertSettingsCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  HardDrive,
  Zap,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

const sevStyles: Record<AlertSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  ok: "bg-success/15 text-success border-success/30",
};

function SevIcon({ severity }: { severity: AlertSeverity }) {
  if (severity === "critical") return <XCircle className="h-4 w-4" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export function DbHealthDashboard() {
  const { data: snapshots, isLoading, error } = useDbHealth();

  const alerts = useMemo(() => computeAlerts(snapshots ?? []), [snapshots]);
  const latest = snapshots?.[0];

  const chartData = useMemo(() => {
    return (snapshots ?? [])
      .slice()
      .reverse()
      .map((s) => ({
        time: format(new Date(s.captured_at), "HH:mm"),
        conexoes: s.connection_pct,
        cache: s.cache_hit_ratio,
        consulta: s.longest_query_secs,
      }));
  }, [snapshots]);

  const worst: AlertSeverity = alerts.some((a) => a.severity === "critical")
    ? "critical"
    : alerts.some((a) => a.severity === "warning")
    ? "warning"
    : "ok";

  if (error) {
    return (
      <Card className="glass">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar as métricas. Este painel é restrito a administradores.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Saúde do Banco de Dados
          </h2>
          <p className="text-sm text-muted-foreground">
            Coleta automática a cada 5 minutos · alertas por desvio do baseline
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("gap-2 px-3 py-1", sevStyles[worst])}
        >
          <SevIcon severity={worst} />
          {worst === "ok" ? "Tudo normal" : worst === "warning" ? "Atenção" : "Crítico"}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Activity className="h-4 w-4 text-primary" />} title="Conexões"
          value={latest ? `${latest.active_connections}/${latest.max_connections}` : "—"}
          sub={latest ? `${latest.connection_pct}% de uso` : ""} loading={isLoading} />
        <KpiCard icon={<Zap className="h-4 w-4 text-primary" />} title="Cache hit ratio"
          value={latest ? `${latest.cache_hit_ratio}%` : "—"}
          sub="ideal ≥ 98%" loading={isLoading} />
        <KpiCard icon={<HardDrive className="h-4 w-4 text-primary" />} title="Tamanho do banco"
          value={latest ? formatBytes(latest.db_size_bytes) : "—"}
          sub={latest ? `${latest.rollbacks} rollbacks` : ""} loading={isLoading} />
        <KpiCard icon={<RotateCcw className="h-4 w-4 text-primary" />} title="Reinícios"
          value={String((snapshots ?? []).filter((s) => s.restart_detected).length)}
          sub="no período monitorado" loading={isLoading} />
      </div>

      {/* Alertas de baseline */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Alertas de Baseline</CardTitle>
          <CardDescription>
            Comparação do valor atual contra a média histórica (baseline dinâmico).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                sevStyles[a.severity],
              )}
            >
              <SevIcon severity={a.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.label}</span>
                  <span className="text-xs font-mono">{a.value}</span>
                </div>
                <p className="text-xs opacity-80">
                  {a.message}
                  {a.baseline ? ` · baseline: ${a.baseline}` : ""}
                </p>
              </div>
            </div>
          ))}
          {alerts.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aguardando primeira coleta de métricas…
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Uso de Conexões (%)</CardTitle>
            <CardDescription>Histórico de saturação do pool</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="connGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Area type="monotone" dataKey="conexoes" stroke="hsl(var(--primary))" fill="url(#connGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Cache Hit Ratio (%)</CardTitle>
            <CardDescription>Indicador indireto de pressão de memória</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Line type="monotone" dataKey="cache" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <DlqHealthCard />

      <DlqAlertSettingsCard />



      {latest && (
        <p className="text-xs text-muted-foreground text-right">
          Última coleta: {format(new Date(latest.captured_at), "dd MMM yyyy, HH:mm:ss", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}

function KpiCard({
  icon, title, value, sub, loading,
}: { icon: React.ReactNode; title: string; value: string; sub: string; loading: boolean }) {
  return (
    <Card className="glass shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "…" : value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
