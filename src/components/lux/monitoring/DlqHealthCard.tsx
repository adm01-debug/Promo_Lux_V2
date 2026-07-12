import { useDlqHealth, useDlqTrend, dlqSeverity, DLQ_THRESHOLDS, type DlqHealthSeverity } from "@/hooks/useDlqHealth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skull, Clock, TrendingUp, RotateCcw, Inbox, Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const sevStyles: Record<DlqHealthSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  ok: "bg-success/15 text-success border-success/30",
};

const sevLabel: Record<DlqHealthSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  ok: "Saudável",
};

function formatAge(secs: number): string {
  if (secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m}min`;
  return `${m}min`;
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1 text-xl font-semibold font-mono", tone)}>{value}</p>
    </div>
  );
}

export function DlqHealthCard() {
  const { data, isLoading } = useDlqHealth();
  const { data: trend } = useDlqTrend(48);
  const severity = dlqSeverity(data);

  const trendData = (trend ?? []).map((p) => ({
    t: new Date(p.captured_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    pending: Number(p.pending_items),
  }));


  return (
    <Card className="glass shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Skull className="h-4 w-4 text-destructive" />
              Saúde da Dead-Letter Queue
            </CardTitle>
            <CardDescription>
              Crescimento e envelhecimento das falhas definitivas ainda não reprocessadas.
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("shrink-0", sevStyles[severity])}>
            {sevLabel[severity]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Pendentes"
            value={isLoading ? "…" : String(data?.pending_items ?? 0)}
            tone={
              (data?.pending_items ?? 0) >= DLQ_THRESHOLDS.pendingCritical
                ? "text-destructive"
                : (data?.pending_items ?? 0) >= DLQ_THRESHOLDS.pendingWarn
                ? "text-warning"
                : undefined
            }
          />
          <Metric
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Mais antigo"
            value={isLoading ? "…" : formatAge(data?.oldest_pending_age_secs ?? 0)}
            tone={
              (data?.oldest_pending_age_secs ?? 0) >= DLQ_THRESHOLDS.ageCriticalSecs
                ? "text-destructive"
                : (data?.oldest_pending_age_secs ?? 0) >= DLQ_THRESHOLDS.ageWarnSecs
                ? "text-warning"
                : undefined
            }
          />
          <Metric
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Novos (24h)"
            value={isLoading ? "…" : String(data?.added_last_24h ?? 0)}
          />
          <Metric
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Reprocessados (24h)"
            value={isLoading ? "…" : String(data?.replayed_last_24h ?? 0)}
            tone="text-emerald-500"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Total histórico: {data?.total_items ?? 0} · já reprocessados: {data?.replayed_items ?? 0}.
          Itens reprocessados são expurgados automaticamente após 30 dias.
        </p>
      </CardContent>
    </Card>
  );
}
