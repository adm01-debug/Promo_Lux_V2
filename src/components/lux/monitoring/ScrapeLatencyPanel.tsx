import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  useApiLatency, useApiLatencyTrend, latencySeverity, LATENCY_THRESHOLDS,
} from "@/hooks/useApiLatency";

const SCRAPE_ENDPOINTS = new Set([
  "scrape-queue-worker",
  "gmaps-proxy",
  "gmaps-places-search",
]);

export const ScrapeLatencyPanel = () => {
  const { data: stats = [], isLoading } = useApiLatency(24, 50);
  const { data: trend = [] } = useApiLatencyTrend(24, 60);

  const scoped = useMemo(
    () => stats.filter((s) => SCRAPE_ENDPOINTS.has(s.path)),
    [stats]
  );

  const worstBySeverity = useMemo(
    () => [...scoped].sort((a, b) => b.p95_ms - a.p95_ms),
    [scoped]
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Latência do Motor de Raspagem (últimas 24h)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          p50/p95/p99 dos endpoints críticos. SLA: p95 &lt; {LATENCY_THRESHOLDS.p95WarnMs}ms; crítico ≥ {LATENCY_THRESHOLDS.p95CriticalMs}ms.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas...
          </div>
        ) : scoped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem chamadas registradas nas últimas 24h para os endpoints de raspagem.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {worstBySeverity.map((s) => {
                const sev = latencySeverity(s);
                const color = sev === "critical"
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : sev === "warning"
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                    : "bg-success/15 text-success border-success/30";
                return (
                  <div key={s.path} className="rounded-md border border-border/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold truncate">{s.path}</span>
                      <Badge variant="outline" className={`text-[10px] ${color}`}>{sev}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                      <div>p50<br/><span className="text-foreground font-mono">{s.p50_ms}ms</span></div>
                      <div>p95<br/><span className="text-foreground font-mono">{s.p95_ms}ms</span></div>
                      <div>p99<br/><span className="text-foreground font-mono">{s.p99_ms}ms</span></div>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      {s.requests.toLocaleString("pt-BR")} req · erro {s.error_rate.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {trend.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit" })}
                      className="text-[10px]"
                    />
                    <YAxis className="text-[10px]" />
                    <Tooltip
                      labelFormatter={(v) => new Date(v).toLocaleString("pt-BR")}
                      formatter={(val: number, name: string) => [`${val}ms`, name]}
                    />
                    <Line type="monotone" dataKey="p50_ms" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="p50" />
                    <Line type="monotone" dataKey="p95_ms" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="p95" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
