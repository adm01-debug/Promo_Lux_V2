import { useDlqHealth, useDlqTrend, dlqSeverity, DLQ_THRESHOLDS, type DlqHealthSeverity } from "@/hooks/useDlqHealth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skull, Clock, TrendingUp, RotateCcw, Inbox, Activity, Download, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { useDlqAlertSettings, useDlqAlertHistory } from "@/hooks/useDlqAlertSettings";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { computePeriodDelta, computeAlertDots, correlateSpikesWithLogs } from "@/lib/dlq/aggregations";
import { useAutomationLogs } from "@/hooks/useAutomationLogs";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

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

interface AlertMarker {
  triggered_at: string;
  pending_items: number;
  pending_critical: number;
  consecutive: number;
  admins_notified: number;
}

function TrendTooltip({
  active,
  payload,
  label,
  alertByLabel,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  alertByLabel: Map<string, AlertMarker>;
}) {
  if (!active || !payload?.length) return null;
  const alert = label ? alertByLabel.get(label) : undefined;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{payload[0].value} pendentes</p>
      {alert && (
        <div className="mt-1.5 border-t border-border/60 pt-1.5 space-y-0.5">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
            Alerta disparado
          </p>
          <p className="text-muted-foreground">
            {new Date(alert.triggered_at).toLocaleString("pt-BR")}
          </p>
          <p className="text-muted-foreground">
            {alert.pending_items} itens · limite {alert.pending_critical} · {alert.consecutive} ciclos
          </p>
          <p className="text-muted-foreground">
            {alert.admins_notified} admin(s) notificado(s)
          </p>
        </div>
      )}
    </div>
  );
}


export function DlqHealthCard() {
  const [prefs, setPrefs] = usePersistedFilters<{ rangeHours: number }>(
    "dlq-health-trend",
    { rangeHours: 48 }
  );
  const rangeHours = prefs.rangeHours;
  const setRangeHours = (hours: number) => setPrefs({ rangeHours: hours });
  const { data, isLoading } = useDlqHealth();
  const { data: trend } = useDlqTrend(rangeHours);
  const { data: trendPrev } = useDlqTrend(rangeHours * 2);
  const { activeOrgId } = useActiveOrganization();
  const { data: alertSettings } = useDlqAlertSettings(activeOrgId);
  const { data: alertHistory } = useDlqAlertHistory(activeOrgId, 50);
  const severity = dlqSeverity(data);

  // Comparativo período-a-período: média de pendências na janela atual
  // versus a janela imediatamente anterior de mesma duração (função pura testada).
  const periodDelta = computePeriodDelta(trendPrev ?? [], rangeHours, Date.now());


  const criticalLimit = alertSettings?.enabled ? alertSettings.pending_critical : undefined;

  const isWeek = rangeHours > 48;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", isWeek
      ? { day: "2-digit", month: "2-digit", hour: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" });

  const trendData = (trend ?? []).map((p) => ({
    t: fmt(p.captured_at),
    ts: new Date(p.captured_at).getTime(),
    pending: Number(p.pending_items),
    // Idade do item mais antigo convertida para horas (envelhecimento).
    ageHours: Math.max(0, Number(p.oldest_pending_age_secs) / 3600),
  }));

  // Só mostra o sparkline de envelhecimento se houver algum item com idade > 0.
  const hasAging = trendData.some((p) => p.ageHours > 0);
  const peakAgeHours = trendData.reduce((max, p) => Math.max(max, p.ageHours), 0);

  // Marca cada alerta no ponto de tendência mais próximo dentro do intervalo
  // (função pura testada em aggregations).
  const alertDots = computeAlertDots(alertHistory ?? [], trendData, rangeHours, Date.now());

  // Índice rótulo-do-eixo → alerta, para enriquecer o tooltip do gráfico.
  const alertByLabel = new Map(alertDots.map((d) => [d.x, d]));

  // Correlação de picos de pendências com logs de automação próximos no tempo.
  // Logs de erro/aviso são os mais informativos para diagnosticar a causa raiz.
  const { data: automationLogs } = useAutomationLogs({ level: "all" });
  const spikeCorrelations = useMemo(
    () =>
      correlateSpikesWithLogs(trendData, automationLogs ?? [], {
        windowMs: 30 * 60_000,
      }).slice(0, 3),
    [trendData, automationLogs],
  );




  const handleExportCsv = () => {
    const rows = trend ?? [];
    if (rows.length === 0) {
      toast.info("Sem histórico de tendência para exportar ainda.");
      return;
    }
    const label = RANGE_OPTIONS.find((o) => o.hours === rangeHours)?.label;
    downloadCsv(
      `dlq-tendencia-${label}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["captured_at", "pending_items", "total_items", "replayed_items", "oldest_pending_age_secs"],
      rows.map((p) => [
        new Date(p.captured_at).toISOString(),
        p.pending_items,
        p.total_items,
        p.replayed_items,
        Math.round(Number(p.oldest_pending_age_secs)),
      ])
    );
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
            <div className="flex items-center rounded-md border border-border/50 bg-secondary/30 p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setRangeHours(opt.hours)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    rangeHours === opt.hours
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Tendência de pendências ({RANGE_OPTIONS.find((o) => o.hours === rangeHours)?.label})
              </span>
              <div className="flex items-center gap-3">
                {periodDelta && (
                  <span
                    className={cn(
                      "flex items-center gap-1 font-medium",
                      periodDelta.diff > 0
                        ? "text-destructive"
                        : periodDelta.diff < 0
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    )}
                    title={`Média atual ${periodDelta.curAvg.toFixed(1)} vs. período anterior ${periodDelta.prevAvg.toFixed(1)}`}
                  >
                    {periodDelta.diff > 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : periodDelta.diff < 0 ? (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    {periodDelta.pct !== null
                      ? `${periodDelta.diff > 0 ? "+" : ""}${periodDelta.pct.toFixed(0)}%`
                      : `${periodDelta.diff > 0 ? "+" : ""}${periodDelta.diff.toFixed(1)}`}
                    <span className="text-muted-foreground">vs. período anterior</span>
                  </span>
                )}
                {alertDots.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                    Alerta disparado
                  </span>
                )}
              </div>

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
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={<TrendTooltip alertByLabel={alertByLabel} />}
                  />

                  <Area
                    type="monotone"
                    dataKey="pending"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    fill="url(#dlqTrendFill)"
                  />
                  {criticalLimit !== undefined && (
                    <ReferenceLine
                      y={criticalLimit}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.7}
                      label={{
                        value: `Crítico: ${criticalLimit}`,
                        position: "insideTopRight",
                        fill: "hsl(var(--destructive))",
                        fontSize: 10,
                      }}
                    />
                  )}
                  {alertDots.map((d) => (
                    <ReferenceDot
                      key={d.id}
                      x={d.x}
                      y={d.y}
                      r={4}
                      fill="hsl(var(--destructive))"
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      isFront
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {trendData.length >= 2 && hasAging && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Envelhecimento do item mais antigo ({RANGE_OPTIONS.find((o) => o.hours === rangeHours)?.label})
              </span>
              <span
                className={cn(
                  "font-mono font-medium",
                  peakAgeHours * 3600 >= DLQ_THRESHOLDS.ageCriticalSecs
                    ? "text-destructive"
                    : peakAgeHours * 3600 >= DLQ_THRESHOLDS.ageWarnSecs
                    ? "text-warning"
                    : "text-muted-foreground"
                )}
                title="Pico de idade no período"
              >
                pico {formatAge(peakAgeHours * 3600)}
              </span>
            </div>
            <div className="h-16 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="dlqAgeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} unit="h" />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    formatter={(value: number) => [formatAge(value * 3600), "Idade"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ageHours"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    fill="url(#dlqAgeFill)"
                  />
                  {DLQ_THRESHOLDS.ageCriticalSecs > 0 && (
                    <ReferenceLine
                      y={DLQ_THRESHOLDS.ageCriticalSecs / 3600}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                    />
                  )}
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
