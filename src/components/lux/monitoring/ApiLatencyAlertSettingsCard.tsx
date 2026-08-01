import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellRing, Save, History } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import {
  useApiLatencyAlertSettings,
  useSaveApiLatencyAlertSettings,
  useApiLatencyAlertHistory,
  API_LATENCY_ALERT_DEFAULTS,
  type ApiLatencyAlertSettings,
} from "@/hooks/useApiLatencyAlertSettings";

const clamp = (v: number, min: number, max: number) =>
  Number.isNaN(v) ? min : Math.min(Math.max(Math.trunc(v), min), max);

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

/**
 * Configuração dos alertas automáticos de latência p95 por rota. Administradores
 * definem o limite crítico (ms), quantos ciclos consecutivos disparam o alerta
 * e o intervalo de silêncio. Mostra também o histórico recente de disparos.
 * Fonte: tabelas `api_latency_alert_settings` / `api_latency_alert_history`.
 */
export function ApiLatencyAlertSettingsCard() {
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.role === "admin";
  const { data, isLoading } = useApiLatencyAlertSettings(activeOrgId);
  const { data: history } = useApiLatencyAlertHistory(activeOrgId, 20);
  const save = useSaveApiLatencyAlertSettings();

  const [form, setForm] = useState<ApiLatencyAlertSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const state =
    form ?? (activeOrgId ? { organization_id: activeOrgId, ...API_LATENCY_ALERT_DEFAULTS } : null);

  const handleSave = () => {
    if (!state) return;
    save.mutate({
      ...state,
      p95_critical_ms: clamp(state.p95_critical_ms, 1, 600000),
      consecutive: clamp(state.consecutive, 1, 24),
      cooldown_hours: clamp(state.cooldown_hours, 1, 168),
    });
  };

  return (
    <Card className="glass shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          Alertas de latência (p95)
        </CardTitle>
        <CardDescription>
          Notifique os administradores quando uma rota ultrapassar o limite crítico de p95 por
          vários ciclos seguidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div>
            <p className="text-sm font-medium">Alertas ativos</p>
            <p className="text-xs text-muted-foreground">
              Notificar quando o limite crítico for atingido.
            </p>
          </div>
          <Switch
            checked={!!state?.enabled}
            disabled={!isAdmin || isLoading || !state}
            onCheckedChange={(v) => state && setForm({ ...state, enabled: v })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lat-pc" className="text-xs">
              p95 crítico (ms)
            </Label>
            <Input
              id="lat-pc"
              type="number"
              min={1}
              value={state?.p95_critical_ms ?? ""}
              disabled={!isAdmin || !state}
              onChange={(e) => state && setForm({ ...state, p95_critical_ms: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lat-cons" className="text-xs">
              Ciclos consecutivos
            </Label>
            <Input
              id="lat-cons"
              type="number"
              min={1}
              max={24}
              value={state?.consecutive ?? ""}
              disabled={!isAdmin || !state}
              onChange={(e) => state && setForm({ ...state, consecutive: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lat-cd" className="text-xs">
              Silêncio entre alertas (h)
            </Label>
            <Input
              id="lat-cd"
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
              ? "Snapshots são capturados a cada 15 min; o alerta dispara quando todos os últimos ciclos da rota estão críticos."
              : "Apenas administradores da organização podem editar estes limites."}
          </p>
          <Button size="sm" onClick={handleSave} disabled={!isAdmin || save.isPending || !state}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>

        {history && history.length > 0 && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Alertas disparados recentemente
            </div>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/40 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-mono text-xs text-foreground">{h.path}</span>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")} ·{" "}
                      {h.admins_notified} admin(s) notificado(s)
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-destructive/30 bg-destructive/10 font-mono text-[10px] text-destructive"
                  >
                    p95 {fmtMs(Number(h.p95_ms))}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
