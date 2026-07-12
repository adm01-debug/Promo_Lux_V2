import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BellRing, Save, History, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { downloadCsv } from "@/lib/csv";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import {
  useDlqAlertSettings,
  useSaveDlqAlertSettings,
  useDlqAlertHistory,
  DLQ_ALERT_DEFAULTS,
  type DlqAlertSettings,
} from "@/hooks/useDlqAlertSettings";

const clamp = (v: number, min: number, max: number) =>
  Number.isNaN(v) ? min : Math.min(Math.max(Math.trunc(v), min), max);

const PERIOD_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
  { label: "Tudo", hours: null },
];

const PAGE_SIZE = 5;

export function DlqAlertSettingsCard() {
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.role === "admin";
  const { data, isLoading } = useDlqAlertSettings(activeOrgId);
  const { data: history } = useDlqAlertHistory(activeOrgId, 50);
  const save = useSaveDlqAlertSettings();

  const [form, setForm] = useState<DlqAlertSettings | null>(null);
  const [page, setPage] = useState(0);

  // Preferência de período persistida entre sessões (e sincronizada entre abas).
  const [historyPrefs, setHistoryPrefs] = usePersistedFilters<{ periodHours: number | null }>(
    "dlq-alert-history",
    { periodHours: 168 }
  );
  const periodHours = historyPrefs.periodHours;
  const setPeriodHours = (hours: number | null) => setHistoryPrefs({ periodHours: hours });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  // Reinicia a paginação sempre que o filtro de período muda.
  useEffect(() => {
    setPage(0);
  }, [periodHours]);

  // Aplica o filtro de período sobre o histórico carregado.
  const filteredHistory = useMemo(
    () => filterByPeriod(history ?? [], periodHours, Date.now()),
    [history, periodHours]
  );

  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedHistory = filteredHistory
    .slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
    .map((h, i) => {
      // Compara com o disparo imediatamente anterior (mais antigo). Como a
      // lista está em ordem decrescente, o anterior é o próximo índice global.
      const globalIdx = safePage * PAGE_SIZE + i;
      const prev = filteredHistory[globalIdx + 1];
      const delta = prev ? h.pending_items - prev.pending_items : null;
      return { ...h, delta };
    });

  // Resumo estatístico e frequência diária (funções puras testadas).
  const periodStats = useMemo(() => computePeriodStats(filteredHistory), [filteredHistory]);
  const dailyFrequency = useMemo(() => computeDailyFrequency(filteredHistory), [filteredHistory]);





  const state = form ?? (activeOrgId ? { organization_id: activeOrgId, ...DLQ_ALERT_DEFAULTS } : null);

  const handleSave = () => {
    if (!state) return;
    save.mutate({
      ...state,
      pending_critical: clamp(state.pending_critical, 1, 100000),
      consecutive: clamp(state.consecutive, 1, 24),
      cooldown_hours: clamp(state.cooldown_hours, 1, 168),
    });
  };

  const handleExportHistory = () => {
    const rows = filteredHistory;
    const periodLabel = PERIOD_OPTIONS.find((o) => o.hours === periodHours)?.label ?? "tudo";
    downloadCsv(
      `dlq-alertas-${periodLabel}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["triggered_at", "pending_items", "pending_critical", "consecutive", "admins_notified"],
      rows.map((h) => [
        new Date(h.triggered_at).toISOString(),
        h.pending_items,
        h.pending_critical,
        h.consecutive,
        h.admins_notified,
      ])
    );
  };


  return (
    <Card className="glass shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          Alertas da Dead-Letter Queue
        </CardTitle>
        <CardDescription>
          Defina quando os administradores devem ser notificados sobre acúmulo de falhas definitivas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div>
            <p className="text-sm font-medium">Alertas ativos</p>
            <p className="text-xs text-muted-foreground">Notificar quando o limite crítico for atingido.</p>
          </div>
          <Switch
            checked={!!state?.enabled}
            disabled={!isAdmin || isLoading || !state}
            onCheckedChange={(v) => state && setForm({ ...state, enabled: v })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dlq-pc" className="text-xs">Limite crítico (pendentes)</Label>
            <Input
              id="dlq-pc"
              type="number"
              min={1}
              value={state?.pending_critical ?? ""}
              disabled={!isAdmin || !state}
              onChange={(e) => state && setForm({ ...state, pending_critical: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlq-cons" className="text-xs">Ciclos consecutivos</Label>
            <Input
              id="dlq-cons"
              type="number"
              min={1}
              max={24}
              value={state?.consecutive ?? ""}
              disabled={!isAdmin || !state}
              onChange={(e) => state && setForm({ ...state, consecutive: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlq-cd" className="text-xs">Silêncio entre alertas (h)</Label>
            <Input
              id="dlq-cd"
              type="number"
              min={1}
              max={168}
              value={state?.cooldown_hours ?? ""}
              disabled={!isAdmin || !state}
              onChange={(e) => state && setForm({ ...state, cooldown_hours: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "Snapshots são capturados a cada hora; o alerta dispara quando todos os últimos ciclos estão críticos."
              : "Apenas administradores da organização podem editar estes limites."}
          </p>
          <Button size="sm" onClick={handleSave} disabled={!isAdmin || save.isPending || !state}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>

        {history && history.length > 0 && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Alertas disparados
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-border/50 bg-secondary/30 p-0.5">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setPeriodHours(opt.hours)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        periodHours === opt.hours
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
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleExportHistory}
                  disabled={filteredHistory.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="rounded-md border border-border/40 bg-secondary/20 px-3 py-3 text-center text-xs text-muted-foreground">
                Nenhum alerta disparado neste período.
              </p>
            ) : (
              <>
                {periodStats && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Disparos</p>
                      <p className="font-mono text-sm font-semibold">{periodStats.count}</p>
                    </div>
                    <div className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Média</p>
                      <p className="font-mono text-sm font-semibold">{periodStats.avg}</p>
                    </div>
                    <div className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Pico</p>
                      <p className="font-mono text-sm font-semibold text-destructive">{periodStats.peak}</p>
                    </div>
                    <div className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Notificações</p>
                      <p className="font-mono text-sm font-semibold">{periodStats.notified}</p>
                    </div>
                  </div>
                )}
                {dailyFrequency.length >= 2 && (
                  <div>
                    <p className="mb-1 text-[10px] text-muted-foreground">Frequência de disparos por dia</p>
                    <div className="h-16 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyFrequency} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={12} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                            formatter={(value: number) => [`${value} disparo(s)`, "Frequência"]}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <ul className="space-y-1.5">
                  {pagedHistory.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-3 py-1.5 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {new Date(h.triggered_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-2 font-mono">
                        {h.delta !== null && (
                          <span
                            className={cn(
                              "flex items-center gap-0.5",
                              h.delta > 0
                                ? "text-destructive"
                                : h.delta < 0
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                            )}
                            title={
                              h.delta === 0
                                ? "Sem variação vs. alerta anterior"
                                : `${h.delta > 0 ? "+" : ""}${h.delta} vs. alerta anterior`
                            }
                          >
                            {h.delta > 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : h.delta < 0 ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            {h.delta !== 0 && `${h.delta > 0 ? "+" : ""}${h.delta}`}
                          </span>
                        )}
                        <span>
                          <span className="text-destructive">{h.pending_items}</span>
                          <span className="text-muted-foreground"> / limite {h.pending_critical}</span>
                          <span className="text-muted-foreground"> · {h.admins_notified} admin(s)</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                {pageCount > 1 && (
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>
                      {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredHistory.length)} de{" "}
                      {filteredHistory.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="font-mono">
                        {safePage + 1}/{pageCount}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={safePage >= pageCount - 1}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
