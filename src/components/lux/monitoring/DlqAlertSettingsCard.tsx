import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BellRing, Save, History, Download } from "lucide-react";
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

export function DlqAlertSettingsCard() {
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.role === "admin";
  const { data, isLoading } = useDlqAlertSettings(activeOrgId);
  const { data: history } = useDlqAlertHistory(activeOrgId, 5);
  const save = useSaveDlqAlertSettings();

  const [form, setForm] = useState<DlqAlertSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Últimos alertas disparados
              </div>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExportHistory}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
            <ul className="space-y-1.5">
              {history.slice(0, 5).map((h) => (
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
                  <span className="font-mono">
                    <span className="text-destructive">{h.pending_items}</span>
                    <span className="text-muted-foreground"> / limite {h.pending_critical}</span>
                    <span className="text-muted-foreground"> · {h.admins_notified} admin(s)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
