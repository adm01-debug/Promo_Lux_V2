/**
 * Painel admin para o sistema de alertas de OrgMismatchError:
 *  - Mostra/edita configurações da org ativa (limite, janela, cooldown).
 *  - Lista os últimos alertas disparados.
 *  - Botão "Avaliar agora" invoca a edge function `org-violation-alerts`.
 *
 * Acesso: apenas admins (gate feito por `usePermissions` no caller).
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Save, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useOrganizations";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AlertSettings {
  organization_id: string;
  enabled: boolean;
  threshold: number;
  window_minutes: number;
  cooldown_minutes: number;
}

interface AlertRow {
  id: string;
  triggered_at: string;
  threshold: number;
  window_minutes: number;
  violation_count: number;
  distinct_actors: number;
  distinct_correlations: number;
  top_tables: Array<{ table: string; count: number }> | null;
  webhook_dispatch: { enqueued?: number; subscribers_total?: number } | null;
}

const DEFAULT_SETTINGS: Omit<AlertSettings, "organization_id"> = {
  enabled: true,
  threshold: 10,
  window_minutes: 60,
  cooldown_minutes: 30,
};

export function OrgViolationAlertsPanel() {
  const { activeOrgId } = useActiveOrganization();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Omit<AlertSettings, "organization_id">>(DEFAULT_SETTINGS);
  const [evaluating, setEvaluating] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["org-violation-alert-settings", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_violation_alert_settings")
        .select("organization_id, enabled, threshold, window_minutes, cooldown_minutes")
        .eq("organization_id", activeOrgId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AlertSettings | null;
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft({
        enabled: settingsQuery.data.enabled,
        threshold: settingsQuery.data.threshold,
        window_minutes: settingsQuery.data.window_minutes,
        cooldown_minutes: settingsQuery.data.cooldown_minutes,
      });
    } else if (settingsQuery.isFetched) {
      setDraft(DEFAULT_SETTINGS);
    }
  }, [settingsQuery.data, settingsQuery.isFetched]);

  const alertsQuery = useQuery({
    queryKey: ["org-violation-alerts", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_violation_alerts")
        .select(
          "id, triggered_at, threshold, window_minutes, violation_count, distinct_actors, distinct_correlations, top_tables, webhook_dispatch",
        )
        .eq("organization_id", activeOrgId!)
        .order("triggered_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AlertRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Sem organização ativa");
      const { error } = await supabase
        .from("org_violation_alert_settings")
        .upsert(
          { organization_id: activeOrgId, ...draft, updated_at: new Date().toISOString() },
          { onConflict: "organization_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["org-violation-alert-settings", activeOrgId] });
    },
    onError: (err) =>
      toast.error("Falha ao salvar", {
        description: err instanceof Error ? err.message : String(err),
      }),
  });

  async function evaluateNow() {
    if (!activeOrgId) return;
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("org-violation-alerts", {
        body: { source: "manual" },
      });
      if (error) throw error;
      const dispatched = (data as { dispatched?: number } | null)?.dispatched ?? 0;
      if (dispatched === 0) {
        toast.info("Nenhum alerta a disparar", {
          description: "Nenhuma organização ultrapassou o limite no momento.",
        });
      } else {
        toast.success(`${dispatched} alerta(s) disparado(s)`);
        qc.invalidateQueries({ queryKey: ["org-violation-alerts", activeOrgId] });
      }
    } catch (err) {
      toast.error("Falha ao avaliar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEvaluating(false);
    }
  }

  if (!activeOrgId) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Alertas de pico de violações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Quando a quantidade de <code className="text-xs">OrgMismatchError</code> dentro
            da janela ultrapassar o limite, um alerta é registrado, notificações são
            enviadas aos admins e webhooks que assinam{" "}
            <code className="text-xs">security.org_violation_threshold</code> são acionados.
            Avaliação automática a cada 5 minutos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between md:justify-start gap-3 md:col-span-1">
              <Label htmlFor="alerts-enabled" className="text-xs">Ativo</Label>
              <Switch
                id="alerts-enabled"
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alerts-threshold" className="text-xs">Limite (eventos)</Label>
              <Input
                id="alerts-threshold"
                type="number"
                min={1}
                value={draft.threshold}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, threshold: Math.max(1, Number(e.target.value) || 1) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alerts-window" className="text-xs">Janela (min)</Label>
              <Input
                id="alerts-window"
                type="number"
                min={5}
                max={1440}
                value={draft.window_minutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    window_minutes: Math.min(1440, Math.max(5, Number(e.target.value) || 60)),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alerts-cooldown" className="text-xs">Cooldown (min)</Label>
              <Input
                id="alerts-cooldown"
                type="number"
                min={1}
                max={1440}
                value={draft.cooldown_minutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cooldown_minutes: Math.min(1440, Math.max(1, Number(e.target.value) || 30)),
                  }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar configurações
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={evaluateNow}
              disabled={evaluating}
            >
              <Zap className={`h-4 w-4 mr-2 ${evaluating ? "animate-pulse" : ""}`} />
              Avaliar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Alertas recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (alertsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum alerta disparado ainda para esta organização.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disparado em</TableHead>
                  <TableHead className="text-right">Eventos</TableHead>
                  <TableHead className="text-right">Atores</TableHead>
                  <TableHead className="text-right">Fluxos</TableHead>
                  <TableHead>Top tabelas</TableHead>
                  <TableHead>Webhooks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(alertsQuery.data ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(a.triggered_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      <div className="text-[10px] text-muted-foreground">
                        janela {a.window_minutes}m · limite {a.threshold}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{a.violation_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{a.distinct_actors}</TableCell>
                    <TableCell className="text-right text-sm">{a.distinct_correlations}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(a.top_tables ?? []).slice(0, 3).map((t) => (
                          <Badge key={t.table} variant="outline" className="text-[10px]">
                            {t.table} ×{t.count}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.webhook_dispatch?.enqueued ?? 0}/
                      {a.webhook_dispatch?.subscribers_total ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}