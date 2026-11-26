import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataError } from "@/components/lux/DataError";
import {
  Activity,
  Database,
  Server,
  ShieldCheck,
  Zap,
  Clock,
  AlertCircle,
  BarChart3,
  Waves,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  useApiLatency,
  useApiLatencyTrend,
  latencySeverity,
} from "@/hooks/useApiLatency";
import { computeAlerts, useDbHealth } from "@/hooks/useDbHealth";
import { dlqSeverity, useDlqHealth } from "@/hooks/useDlqHealth";
import { STATE_LABEL, usePublicStatus, usePublicUptime, type ComponentState } from "@/hooks/useStatusPage";
import { DEFAULT_AUDIT_FILTERS, useAuditTrail } from "@/hooks/useAuditTrail";

type Severity = "ok" | "warning" | "critical";

/** Pior estado entre as fontes. `unknown` fica acima de `operational`:
 * sem dado nunca conta como saudável. */
const RANK: Record<ComponentState, number> = { outage: 3, degraded: 2, unknown: 1, operational: 0 };

const worstState = (current: ComponentState, next: ComponentState): ComponentState =>
  RANK[next] > RANK[current] ? next : current;

const fromSeverity = (severity: Severity): ComponentState =>
  severity === "critical" ? "outage" : severity === "warning" ? "degraded" : "operational";

const worstSeverity = (severities: Severity[]): Severity =>
  severities.includes("critical") ? "critical" : severities.includes("warning") ? "warning" : "ok";

const STATE_BADGE: Record<ComponentState, string> = {
  operational: "bg-success hover:bg-success/90",
  degraded: "bg-warning hover:bg-warning/90",
  outage: "bg-destructive hover:bg-destructive/90",
  unknown: "bg-muted text-muted-foreground hover:bg-muted/90",
};

const STATE_HEADLINE: Record<ComponentState, string> = {
  operational: "Sistemas Operacionais",
  degraded: "Atenção Requerida",
  outage: "Falha Detectada",
  unknown: "Sem dados",
};

const fmtMs = (value: number | null | undefined) =>
  value === null || value === undefined ? "Sem dados" : `${Math.round(value)} ms`;

const fmtPct = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? "Sem dados" : `${value.toFixed(digits)}%`;

export const MonitoringView = memo(() => {
  const { data: publicStatus, isLoading: loadingStatus } = usePublicStatus();
  const { data: uptimeDays } = usePublicUptime(30);
  const { data: dbSnapshots, isLoading: loadingDb } = useDbHealth();
  const { data: dlq, isLoading: loadingDlq } = useDlqHealth();
  const { data: latencyStats, isLoading: loadingLatency } = useApiLatency(24, 20);
  const { data: latencyTrend } = useApiLatencyTrend(24, 60);
  const { data: auditTrail, isLoading: loadingAudit, isError: auditFailed, refetch: refetchAudit } = useAuditTrail({ ...DEFAULT_AUDIT_FILTERS, pageSize: 10 });
  const auditLogs = auditTrail?.rows ?? [];

  const dbAlerts = computeAlerts(dbSnapshots ?? []);
  const dbSnapshot = dbSnapshots?.[0];

  const latency = latencyStats ?? [];
  const totalRequests = latency.reduce((sum, stat) => sum + stat.requests, 0);
  const totalErrors = latency.reduce((sum, stat) => sum + stat.errors, 0);
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : null;
  const worstLatency = latency.reduce<typeof latency[number] | undefined>(
    (worst, stat) => (!worst || stat.p95_ms > worst.p95_ms ? stat : worst),
    undefined,
  );
  const p95Ms = latency.length > 0 ? (worstLatency?.p95_ms ?? null) : null;
  const worstLatencySeverity = latency.length > 0 ? latencySeverity(worstLatency!) : "critical";

  const uptimeWithData = (uptimeDays ?? []).filter((day) => day.uptime_pct !== null);
  const uptimeEvents = uptimeWithData.reduce((sum, day) => sum + day.events, 0);
  const uptimePct =
    uptimeEvents > 0
      ? uptimeWithData.reduce((sum, day) => sum + (day.uptime_pct ?? 0) * day.events, 0) / uptimeEvents
      : null;

  const dlqState = dlqSeverity(dlq);
  const dbState = fromSeverity(worstSeverity(dbAlerts.map((alert) => alert.severity)));

  const fontes: ComponentState[] = [];
  if (publicStatus) fontes.push(publicStatus.overall);
  if (dbSnapshot) fontes.push(dbState);
  if (dlq) fontes.push(fromSeverity(dlqState));
  if (latency.length > 0) fontes.push(fromSeverity(worstLatencySeverity));
  const carregando = loadingStatus || loadingDb || loadingDlq || loadingLatency;
  const overall: ComponentState =
    carregando || fontes.length === 0 ? "unknown" : fontes.reduce(worstState);

  const performanceData = (latencyTrend ?? []).map((point) => ({
    time: new Date(point.bucket).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    p95: Math.round(point.p95_ms),
    p50: Math.round(point.p50_ms),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status do Sistema</h1>
          <p className="text-muted-foreground">Monitoramento de infraestrutura e SLIs em tempo real.</p>
        </div>
        <Badge
          variant="secondary"
          className={cn("px-4 py-1 text-sm gap-2", STATE_BADGE[overall])}
        >
          <Activity className="h-3.5 w-3.5" />
          {loadingStatus || loadingDb || loadingDlq || loadingLatency ? "Carregando" : STATE_HEADLINE[overall]}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latência de API (p95)</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingLatency ? "..." : fmtMs(p95Ms)}</div>
            <p className="text-xs text-muted-foreground">
              {worstLatency
                ? `Pior rota: ${worstLatency.path} em 24 h`
                : "Nenhuma requisição registrada em 24 h"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibilidade (SLO)</CardTitle>
            <ShieldCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtPct(uptimePct)}</div>
            <p className="text-xs text-muted-foreground">
              {uptimeWithData.length > 0
                ? `Últimos 30 dias (${uptimeWithData.length} dia(s) com evento) · Meta: 99,9%`
                : "Nenhum evento de disponibilidade em 30 dias · Meta: 99,9%"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingLatency ? "..." : fmtPct(errorRate)}</div>
            <p className="text-xs text-muted-foreground">
              {totalRequests > 0
                ? `${totalErrors} erro(s) em ${totalRequests} requisição(ões) nas últimas 24 h`
                : "Nenhuma requisição registrada em 24 h"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingDb ? "..." : fmtPct(dbSnapshot?.connection_pct, 1)}</div>
            <p className="text-xs text-muted-foreground">
              {dbSnapshot
                ? `Conexões (${dbSnapshot.active_connections}/${dbSnapshot.max_connections}) · Cache ${dbSnapshot.cache_hit_ratio}%`
                : "Nenhuma medição do banco registrada"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle>Performance de Requisições (ms)</CardTitle>
            </div>
            <CardDescription>Latência p50 vs p95 nas últimas 24 h</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {performanceData.length === 0 ? (
              <EmptyPanel text="Sem dados de latência nas últimas 24 h." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}ms`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="p95" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorP95)" strokeWidth={2} />
                  <Area type="monotone" dataKey="p50" stroke="hsl(var(--muted-foreground))" fill="transparent" strokeWidth={1} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle>Últimos Logs de Auditoria</CardTitle>
            </div>
            <CardDescription>Ações críticas rastreadas pelo sistema de Distributed Tracing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditFailed ? (
                <DataError
                  message="Falha ao carregar a trilha de auditoria."
                  onRetry={() => refetchAudit()}
                />
              ) : loadingAudit ? (
                <div className="space-y-2" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/40" />
                  ))}
                </div>
              ) : null}
              {!loadingAudit && !auditFailed && auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.action}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                      <span>•</span>
                      <span className="font-mono">{log.actor?.full_name || "sistema"}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{log.table_name}</Badge>
                </div>
              ))}
              {auditLogs.length === 0 && !loadingAudit && !auditFailed && (
                <EmptyPanel text="Nenhum log crítico registrado recentemente." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass shadow-sm md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Fila morta e alertas do banco</CardTitle>
            </div>
            <CardDescription>Estado real das fontes de monitoramento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDlq || loadingDb ? (
              <EmptyPanel text="Carregando fontes..." />
            ) : (
              <>
                <HealthItem
                  name="Fila morta (DLQ)"
                  state={dlq ? fromSeverity(dlqState) : "unknown"}
                  detail={dlq ? `${dlq.pending_items} item(ns) · mais antigo ${Math.round(dlq.oldest_pending_age_secs / 60)} min` : fmtMs(null)}
                />
                {dbAlerts.length > 0 ? (
                  dbAlerts.map((alert) => (
                    <HealthItem
                      key={alert.key}
                      name={alert.label}
                      state={fromSeverity(alert.severity)}
                      detail={alert.value}
                    />
                  ))
                ) : (
                  <HealthItem name="Banco de dados" state="unknown" detail="Nenhuma medição registrada" />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribuição Geográfica de Tráfego</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[180px] bg-secondary/20 rounded-lg border border-dashed border-border">
            <div className="text-center">
              <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="text-xs text-muted-foreground italic">Visualização de mapa geográfico em desenvolvimento</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px] text-center text-muted-foreground text-sm">
      {text}
    </div>
  );
}

function HealthItem({ name, state, detail }: { name: string; state: ComponentState; detail: string }) {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            state === "operational" ? "bg-success" : state === "degraded" ? "bg-warning" : state === "outage" ? "bg-destructive" : "bg-muted-foreground/50",
          )}
        />
        <span className="font-medium truncate">{name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-muted-foreground">{detail}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] h-4",
            state === "operational"
              ? "bg-success/20 text-success border-success/30"
              : state === "degraded"
                ? "bg-warning/20 text-warning border-warning/30"
                : state === "outage"
                  ? "bg-destructive/20 text-destructive border-destructive/30"
                  : "bg-muted text-muted-foreground border-border",
          )}
        >
          {STATE_LABEL[state].toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

MonitoringView.displayName = "MonitoringView";
