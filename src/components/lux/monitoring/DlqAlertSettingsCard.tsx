import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BellRing, Save, History, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { downloadCsv } from "@/lib/csv";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { filterByPeriod, computePeriodStats, computeDailyFrequency, sortHistory, type SortKey, type SortDir } from "@/lib/dlq/aggregations";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import {
  useDlqAlertSettings,
  useSaveDlqAlertSettings,
  useDlqAlertHistory,
  DLQ_ALERT_DEFAULTS,
  type DlqAlertSettings,
  type DlqQueueKind,
} from "@/hooks/useDlqAlertSettings";

const clamp = (v: number, min: number, max: number) =>
  Number.isNaN(v) ? min : Math.min(Math.max(Math.trunc(v), min), max);

const PERIOD_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
  { label: "Tudo", hours: null },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE = 5;
/** Garante que o tamanho de página persistido seja um valor válido/suportado. */
const normalizePageSize = (v: unknown): number =>
  PAGE_SIZE_OPTIONS.includes(v as (typeof PAGE_SIZE_OPTIONS)[number])
    ? (v as number)
    : DEFAULT_PAGE_SIZE;

export function DlqAlertSettingsCard() {
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.role === "admin";
  const { data, isLoading } = useDlqAlertSettings(activeOrgId);
  const { data: history } = useDlqAlertHistory(activeOrgId, 50);
  const save = useSaveDlqAlertSettings();

  const [form, setForm] = useState<DlqAlertSettings | null>(null);
  const [page, setPage] = useState(0);

  // Preferências persistidas entre sessões (e sincronizadas entre abas).
  const [historyPrefs, setHistoryPrefs] = usePersistedFilters<{
    periodHours: number | null;
    sortKey: SortKey;
    sortDir: SortDir;
    pageSize: number;
  }>("dlq-alert-history", { periodHours: 168, sortKey: "date", sortDir: "desc", pageSize: DEFAULT_PAGE_SIZE });
  const periodHours = historyPrefs.periodHours;
  const setPeriodHours = (hours: number | null) => setHistoryPrefs({ ...historyPrefs, periodHours: hours });
  const sortKey = historyPrefs.sortKey ?? "date";
  const sortDir = historyPrefs.sortDir ?? "desc";
  const pageSize = normalizePageSize(historyPrefs.pageSize);
  const setPageSize = (size: number) => setHistoryPrefs({ ...historyPrefs, pageSize: size });
  const toggleSort = (key: SortKey) =>
    setHistoryPrefs({
      ...historyPrefs,
      sortKey: key,
      // Alterna direção ao reclicar a mesma chave; nova chave começa decrescente.
      sortDir: sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : "desc",
    });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  // Reinicia a paginação quando o filtro, a ordenação ou o tamanho mudam.
  useEffect(() => {
    setPage(0);
  }, [periodHours, sortKey, sortDir, pageSize]);

  // Aplica o filtro de período sobre o histórico carregado.
  const filteredHistory = useMemo(
    () => filterByPeriod(history ?? [], periodHours, Date.now()),
    [history, periodHours]
  );

  // Delta (variação vs. disparo anterior no tempo) é sempre calculado sobre a
  // ordem cronológica decrescente, independentemente da ordenação de exibição.
  const deltaById = useMemo(() => {
    const byDateDesc = sortHistory(filteredHistory, "date", "desc");
    const map = new Map<string, number | null>();
    byDateDesc.forEach((h, i) => {
      const prev = byDateDesc[i + 1];
      map.set(h.id, prev ? h.pending_items - prev.pending_items : null);
    });
    return map;
  }, [filteredHistory]);

  // Ordenação configurável de exibição (persistida entre sessões).
  const sortedHistory = useMemo(
    () => sortHistory(filteredHistory, sortKey, sortDir),
    [filteredHistory, sortKey, sortDir]
  );

  const pageCount = Math.max(1, Math.ceil(sortedHistory.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedHistory = sortedHistory
    .slice(safePage * pageSize, safePage * pageSize + pageSize)
    .map((h) => ({ ...h, delta: deltaById.get(h.id) ?? null }));

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
                <div className="flex items-center rounded-md border border-border/50 bg-secondary/30 p-0.5">
                  {([
                    { key: "date" as SortKey, label: "Data" },
                    { key: "volume" as SortKey, label: "Volume" },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleSort(opt.key)}
                      className={cn(
                        "flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        sortKey === opt.key
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={`Ordenar por ${opt.label.toLowerCase()}`}
                    >
                      {opt.label}
                      {sortKey === opt.key ? (
                        sortDir === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
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

                {sortedHistory.length > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>
                        {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filteredHistory.length)} de{" "}
                        {filteredHistory.length}
                      </span>
                      <div className="flex items-center gap-1" role="group" aria-label="Itens por página">
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setPageSize(size)}
                            aria-pressed={pageSize === size}
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono transition-colors",
                              pageSize === size
                                ? "bg-primary/15 text-primary"
                                : "hover:bg-muted"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pageCount > 1 && (
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
                    )}
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
