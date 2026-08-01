import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gauge, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApiLatency,
  useApiLatencyTrend,
  latencySeverity,
  LATENCY_THRESHOLDS,
  type ApiLatencyStat,
  type LatencySeverity,
} from "@/hooks/useApiLatency";
import { LatencySparkline } from "./LatencySparkline";

const WINDOWS: { label: string; hours: number }[] = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

const SEVERITY_STYLES: Record<LatencySeverity, string> = {
  critical: "text-destructive border-destructive/30 bg-destructive/10",
  warning: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  ok: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
};

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

interface LatencyRowProps {
  stat: ApiLatencyStat;
}

function LatencyRow({ stat }: LatencyRowProps) {
  const severity = latencySeverity(stat);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", SEVERITY_STYLES[severity])}>
            {severity === "critical" ? "crítico" : severity === "warning" ? "atenção" : "saudável"}
          </Badge>
          <span className="truncate font-mono text-xs text-foreground">{stat.path}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {stat.requests.toLocaleString("pt-BR")} req · {stat.error_rate}% erro ({stat.errors})
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3 text-right">
        {(
          [
            ["p50", stat.p50_ms],
            ["p95", stat.p95_ms],
            ["p99", stat.p99_ms],
            ["máx", stat.max_ms],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p
              className={cn(
                "font-mono text-xs tabular-nums",
                label === "p95" && value >= LATENCY_THRESHOLDS.p95CriticalMs && "text-destructive",
                label === "p95" &&
                  value >= LATENCY_THRESHOLDS.p95WarnMs &&
                  value < LATENCY_THRESHOLDS.p95CriticalMs &&
                  "text-amber-500",
              )}
            >
              {fmtMs(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Painel de observabilidade de latência das APIs/edge functions: p50/p95/p99,
 * volume e taxa de erro por rota, com classificação de severidade e janela
 * ajustável. Fonte: RPC `api_latency_stats` (isolada por organização).
 */
export function ApiLatencyPanel() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, isError, refetch, isFetching } = useApiLatency(hours);
  const { data: trend } = useApiLatencyTrend(hours);
  const trendPoints = trend ?? [];

  const stats = data ?? [];
  const worst = stats[0];
  const totalReq = stats.reduce((s, r) => s + r.requests, 0);
  const totalErr = stats.reduce((s, r) => s + r.errors, 0);
  const overallErrRate = totalReq > 0 ? ((100 * totalErr) / totalReq).toFixed(2) : "0.00";

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" />
              Latência das APIs (p95)
            </CardTitle>
            <CardDescription className="text-xs">
              Percentis de tempo de resposta e taxa de erro por rota
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border/50 p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.hours}
                  type="button"
                  onClick={() => setHours(w.hours)}
                  className={cn(
                    "rounded px-2 py-1 text-xs transition-colors",
                    hours === w.hours
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Atualizar latência"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isLoading && !isError && stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pior p95</p>
              <p className="mt-1 font-mono text-lg tabular-nums">{worst ? fmtMs(worst.p95_ms) : "—"}</p>
              <p className="truncate text-[10px] text-muted-foreground">{worst?.path}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requisições</p>
              <p className="mt-1 font-mono text-lg tabular-nums">{totalReq.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Taxa de erro</p>
              <p
                className={cn(
                  "mt-1 font-mono text-lg tabular-nums",
                  Number(overallErrRate) >= LATENCY_THRESHOLDS.errorRateCritical && "text-destructive",
                )}
              >
                {overallErrRate}%
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && trendPoints.length > 1 && (
          <div className="rounded-lg border border-border/50 bg-card/40 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tendência p95
              </p>
              <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {fmtMs(Number(trendPoints[trendPoints.length - 1].p95_ms))} atual
              </p>
            </div>
            <LatencySparkline points={trendPoints} />
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Não foi possível carregar as métricas de latência.
          </div>
        )}

        {!isLoading && !isError && stats.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            Nenhuma requisição de API registrada nesta janela.
          </div>
        )}

        {!isLoading &&
          !isError &&
          stats.map((stat) => <LatencyRow key={stat.path} stat={stat} />)}
      </CardContent>
    </Card>
  );
}
