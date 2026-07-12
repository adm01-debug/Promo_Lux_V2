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
  const [periodHours, setPeriodHours] = useState<number | null>(168);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  // Reinicia a paginação sempre que o filtro de período muda.
  useEffect(() => {
    setPage(0);
  }, [periodHours]);

  // Aplica o filtro de período sobre o histórico carregado.
  const filteredHistory = useMemo(() => {
    const rows = history ?? [];
    if (periodHours === null) return rows;
    const cutoff = Date.now() - periodHours * 3600_000;
    return rows.filter((h) => new Date(h.triggered_at).getTime() >= cutoff);
  }, [history, periodHours]);

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

  // Resumo estatístico do período filtrado: nº de disparos, média e pico de
  // pendentes, além do total de admins notificados.
  const periodStats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    const pendings = filteredHistory.map((h) => h.pending_items);
    const total = pendings.reduce((a, b) => a + b, 0);
    const notified = filteredHistory.reduce((a, h) => a + h.admins_notified, 0);
    return {
      count: filteredHistory.length,
      avg: Math.round(total / filteredHistory.length),
      peak: Math.max(...pendings),
      notified,
    };
  }, [filteredHistory]);

  // Frequência de disparos agrupada por dia (ordem cronológica crescente).
  const dailyFrequency = useMemo(() => {
    if (filteredHistory.length === 0) return [];
    const byDay = new Map<string, number>();
    for (const h of filteredHistory) {
      const d = new Date(h.triggered_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [, mm, dd] = key.split("-");
        return { day: `${dd}/${mm}`, count };
      });
  }, [filteredHistory]);





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
