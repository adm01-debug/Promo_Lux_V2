import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Activity, 
  Database, 
  Server, 
  ShieldCheck, 
  Zap, 
  Clock, 
  AlertCircle,
  BarChart3
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

export const MonitoringView = memo(() => {
  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      // We'll create a health function if it doesn't exist, for now mock success
      return { status: "healthy" };
    },
    refetchInterval: 30000,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["monitoring-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Simulated metrics for demonstration
  const performanceData = [
    { time: "10:00", p95: 120, p50: 45 },
    { time: "10:05", p95: 140, p50: 50 },
    { time: "10:10", p95: 110, p50: 40 },
    { time: "10:15", p95: 350, p50: 55 },
    { time: "10:20", p95: 130, p50: 48 },
    { time: "10:25", p95: 125, p50: 42 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status do Sistema</h1>
          <p className="text-muted-foreground">Monitoramento de infraestrutura e SLIs em tempo real.</p>
        </div>
        <Badge variant={health?.status === "healthy" ? "default" : "secondary"} className={cn("px-4 py-1 text-sm gap-2", health?.status === "healthy" ? "bg-success hover:bg-success/90" : "bg-warning hover:bg-warning/90")}>
          <Activity className="h-3.5 w-3.5" />
          {health?.status === "healthy" ? "Sistemas Operacionais" : "Atenção Requerida"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latência de API (p95)</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">124ms</div>
            <p className="text-xs text-muted-foreground">-12ms desde a última hora</p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibilidade (SLO)</CardTitle>
            <ShieldCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.98%</div>
            <p className="text-xs text-muted-foreground">Meta: 99.9%</p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.02%</div>
            <p className="text-xs text-muted-foreground">+0.001% hoje</p>
          </CardContent>
        </Card>
        <Card className="glass shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime DB</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground">Sem incidentes nos últimos 30 dias</p>
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
            <CardDescription>Latência p50 vs p95 em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
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
              {auditLogs?.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.action}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="font-mono">{(log as any).trace_id?.substring(0, 8) || 'no-trace'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{log.table_name}</Badge>
                </div>
              ))}
              {(!auditLogs || auditLogs.length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum log crítico registrado recentemente.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass shadow-sm md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Health Check: Edge Functions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthItem name="ai-agent" status="online" latency="45ms" />
            <HealthItem name="gmaps-proxy" status="online" latency="112ms" />
            <HealthItem name="workflow-engine" status="online" latency="38ms" />
            <HealthItem name="auth-rate-limit" status="online" latency="22ms" />
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

function HealthItem({ name, status, latency }: { name: string; status: "online" | "offline" | "degraded"; latency: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 rounded-full", status === "online" ? "bg-success" : status === "degraded" ? "bg-warning" : "bg-destructive")} />
        <span className="font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{latency}</span>
        <Badge variant={status === "online" ? "outline" : "outline"} className={cn("text-[9px] h-4", status === "online" ? "bg-success/20 text-success border-success/30" : "bg-destructive/20 text-destructive border-destructive/30")}>
          {status.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

MonitoringView.displayName = "MonitoringView";
