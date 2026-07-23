import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timer, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlaAlertSettingsCard } from "./SlaAlertSettingsCard";

type Row = {
  queue_kind: "scrape" | "web" | "instagram";
  sample_size: number;
  with_sla: number;
  breaches: number;
  breach_rate: number;
  p50_seconds: number | null;
  p95_seconds: number | null;
  p99_seconds: number | null;
  sla_p50: number | null;
  sla_p95: number | null;
};

const HOURS_OPTIONS = [1, 6, 24, 72, 168];

const LABELS: Record<Row["queue_kind"], string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 60) return `${(v / 60).toFixed(1)}m`;
  return `${Number(v).toFixed(1)}s`;
}

export function SlaCompliancePanel() {
  const [hours, setHours] = useState<number>(24);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sla-compliance-stats", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sla_compliance_stats", { p_hours: hours });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ["sla-alert-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_alert_history")
        .select("id, queue_kind, breach_rate, sample_size, window_hours, triggered_at")
        .order("triggered_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });


  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Conformidade de SLA por fila
          </CardTitle>
          <CardDescription>
            Distribuição de duração real (p50/p95/p99) vs. SLA definido no enqueue. Detecta filas onde o SLA está subestimado.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border/40 bg-secondary/20 p-1">
            {HOURS_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition",
                  hours === h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {h < 24 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-secondary/20 animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem execuções concluídas na janela selecionada.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.map((row) => {
              const breachPct = (row.breach_rate ?? 0) * 100;
              const status: "ok" | "warn" | "crit" =
                breachPct >= 20 ? "crit" : breachPct >= 5 ? "warn" : "ok";
              const p95Over =
                row.p95_seconds != null &&
                row.sla_p95 != null &&
                row.p95_seconds > row.sla_p95;
              return (
                <div
                  key={row.queue_kind}
                  className={cn(
                    "rounded-lg border p-4 space-y-3",
                    status === "crit"
                      ? "border-destructive/40 bg-destructive/5"
                      : status === "warn"
                      ? "border-warning/40 bg-warning/5"
                      : "border-border/40 bg-secondary/10",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{LABELS[row.queue_kind]}</div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1",
                        status === "crit"
                          ? "border-destructive/50 text-destructive"
                          : status === "warn"
                          ? "border-warning/50 text-warning"
                          : "border-success/50 text-success",
                      )}
                    >
                      {status === "ok" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {breachPct.toFixed(1)}% breach
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">p50</div>
                      <div className="font-mono">{fmt(row.p50_seconds)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">p95</div>
                      <div className={cn("font-mono", p95Over && "text-destructive")}>
                        {fmt(row.p95_seconds)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">p99</div>
                      <div className="font-mono">{fmt(row.p99_seconds)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/30 pt-2">
                    <div>
                      <div className="text-muted-foreground">SLA p50</div>
                      <div className="font-mono">{fmt(row.sla_p50)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">SLA p95</div>
                      <div className="font-mono">{fmt(row.sla_p95)}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>{row.sample_size} execuções</span>
                    <span>
                      {row.breaches}/{row.with_sla} c/ SLA
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {alerts && alerts.length > 0 && (
          <div className="mt-6 border-t border-border/30 pt-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Últimos alertas de SLA
            </div>
            <div className="space-y-1.5">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded bg-secondary/20 border border-border/30"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {a.queue_kind}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(Number(a.breach_rate) * 100).toFixed(1)}% breach • {a.sample_size} amostras • janela {a.window_hours}h
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {new Date(a.triggered_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

