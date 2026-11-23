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
  useCircuitBreakerAlertSettings,
  useSaveCircuitBreakerAlertSettings,
  useCircuitBreakerAlertHistory,
  CB_ALERT_DEFAULTS,
  type CircuitBreakerAlertSettings,
} from "@/hooks/useCircuitBreakerAlerts";

const clamp = (v: number, min: number, max: number) =>
  Number.isNaN(v) ? min : Math.min(Math.max(Math.trunc(v), min), max);

const REASON_LABEL: Record<string, string> = {
  opened: "aberto",
  "half-open": "meio-aberto",
  threshold: "limiar de falhas",
};

/**
 * Configuração global dos alertas de disjuntor. Administradores definem se o
 * alerta está ativo, se dispara ao abrir o disjuntor, o limiar de falhas
 * consecutivas e o intervalo de silêncio por serviço. Mostra também o
 * histórico recente de disparos.
 * Fonte: `circuit_breaker_alert_settings` / `circuit_breaker_alert_history`,
 * avaliadas a cada 5 min pela edge function `circuit-breaker-alerts`.
 */
export function CircuitBreakerAlertSettingsCard() {
  const { activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.role === "admin";
  const { data, isLoading } = useCircuitBreakerAlertSettings();
  const { data: history } = useCircuitBreakerAlertHistory(20);
  const save = useSaveCircuitBreakerAlertSettings();

  const [form, setForm] = useState<CircuitBreakerAlertSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const state = form ?? CB_ALERT_DEFAULTS;

  const handleSave = () => {
    save.mutate({
      ...state,
      failure_count_threshold: clamp(state.failure_count_threshold, 1, 100),
      cooldown_minutes: clamp(state.cooldown_minutes, 1, 1440),
    });
  };

  return (
    <Card className="glass shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          Alertas de disjuntor
        </CardTitle>
        <CardDescription>
          Notifique os administradores quando um disjuntor abrir ou quando um serviço acumular
          falhas consecutivas acima do limiar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div>
            <p className="text-sm font-medium">Alertas ativos</p>
            <p className="text-xs text-muted-foreground">
              Desligado, nenhum alerta de disjuntor é enviado.
            </p>
          </div>
          <Switch
            checked={state.enabled}
            disabled={!isAdmin || isLoading}
            onCheckedChange={(v) => setForm({ ...state, enabled: v })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div>
            <p className="text-sm font-medium">Alertar ao abrir</p>
            <p className="text-xs text-muted-foreground">
              Dispara assim que o disjuntor passa para aberto ou meio-aberto.
            </p>
          </div>
          <Switch
            checked={state.alert_on_open}
            disabled={!isAdmin || isLoading}
            onCheckedChange={(v) => setForm({ ...state, alert_on_open: v })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cb-thr" className="text-xs">
              Falhas consecutivas para alertar
            </Label>
            <Input
              id="cb-thr"
              type="number"
              min={1}
              max={100}
              value={state.failure_count_threshold}
              disabled={!isAdmin}
              onChange={(e) =>
                setForm({ ...state, failure_count_threshold: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-cd" className="text-xs">
              Silêncio entre alertas (min)
            </Label>
            <Input
              id="cb-cd"
              type="number"
              min={1}
              max={1440}
              value={state.cooldown_minutes}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...state, cooldown_minutes: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "Os disjuntores são avaliados a cada 5 min; o silêncio é por serviço."
              : "Apenas administradores da organização podem editar estes limites."}
          </p>
          <Button size="sm" onClick={handleSave} disabled={!isAdmin || save.isPending}>
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
                    <span className="truncate font-mono text-xs text-foreground">
                      {h.service_name}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(h.triggered_at).toLocaleString("pt-BR")} ·{" "}
                      {h.admins_notified} admin(s) notificado(s)
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-destructive/30 bg-destructive/10 font-mono text-[10px] text-destructive"
                  >
                    {REASON_LABEL[h.reason] ?? h.reason} · {h.failure_count}
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