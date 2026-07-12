import { useDlqHealth, useDlqTrend, dlqSeverity, DLQ_THRESHOLDS, type DlqHealthSeverity } from "@/hooks/useDlqHealth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skull, Clock, TrendingUp, RotateCcw, Inbox, Activity, Download } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

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

const RANGE_OPTIONS: { label: string; hours: number }[] = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

export function DlqHealthCard() {
  const [rangeHours, setRangeHours] = useState(48);
  const { data, isLoading } = useDlqHealth();
  const { data: trend } = useDlqTrend(rangeHours);
  const severity = dlqSeverity(data);

  const isWeek = rangeHours > 48;
  const trendData = (trend ?? []).map((p) => ({
    t: new Date(p.captured_at).toLocaleString("pt-BR", isWeek
      ? { day: "2-digit", month: "2-digit", hour: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" }),
    pending: Number(p.pending_items),
  }));

  const handleExportCsv = () => {
    const rows = trend ?? [];
    if (rows.length === 0) {
      toast.info("Sem histórico de tendência para exportar ainda.");
      return;
    }
    const header = [
      "captured_at",
      "pending_items",
      "total_items",
      "replayed_items",
      "oldest_pending_age_secs",
    ];
    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(","),
      ...rows.map((p) =>
        [
          new Date(p.captured_at).toISOString(),
          p.pending_items,
          p.total_items,
          p.replayed_items,
          Math.round(Number(p.oldest_pending_age_secs)),
        ]
          .map(escape)
          .join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dlq-tendencia-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} registros exportados.`);
  };




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
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportCsv}
              disabled={(trend ?? []).length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Badge variant="outline" className={cn(sevStyles[severity])}>
              {sevLabel[severity]}
            </Badge>
          </div>
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

        {trendData.length >= 2 && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Tendência de pendências (48h)
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="dlqTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(v: number) => [String(v), "Pendentes"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    fill="url(#dlqTrendFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Total histórico: {data?.total_items ?? 0} · já reprocessados: {data?.replayed_items ?? 0}.
          Itens reprocessados são expurgados automaticamente após 30 dias.
        </p>
      </CardContent>
    </Card>
  );
}
