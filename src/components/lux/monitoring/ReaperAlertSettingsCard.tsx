import { useEffect, useMemo, useState } from "react";
import { BellRing, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PainelComEstado } from "./PainelComEstado";
import {
  REAPER_SETTINGS_DEFAULTS,
  REAPER_SETTINGS_LIMITS,
  useReaperAlertSettings,
  useUpdateReaperAlertSettings,
  validarAjustesReaper,
  type ReaperAlertSettingsInput,
} from "@/hooks/useReaperAlertSettings";

const CAMPOS: Array<{
  key: keyof Omit<ReaperAlertSettingsInput, "enabled">;
  label: string;
  hint: string;
}> = [
  {
    key: "consecutive",
    label: "Execuções consecutivas",
    hint: `quantas execuções seguidas com tarefa morta disparam o alerta (${REAPER_SETTINGS_LIMITS.consecutive.min}–${REAPER_SETTINGS_LIMITS.consecutive.max})`,
  },
  {
    key: "min_dead_per_run",
    label: "Mínimo de tarefas mortas",
    hint: "tarefas na DLQ por execução para contar como problema (0 = qualquer motivo)",
  },
  {
    key: "no_run_hours",
    label: "Horas sem execução",
    hint: `alerta quando o reaper fica este tempo sem rodar (${REAPER_SETTINGS_LIMITS.no_run_hours.min}–${REAPER_SETTINGS_LIMITS.no_run_hours.max})`,
  },
  {
    key: "cooldown_hours",
    label: "Intervalo entre alertas",
    hint: `espera mínima para repetir o mesmo motivo (${REAPER_SETTINGS_LIMITS.cooldown_hours.min}–${REAPER_SETTINGS_LIMITS.cooldown_hours.max})`,
  },
];

/**
 * Limiares do cron `reaper-alerts` (reaper_alert_settings).
 * A tabela e as policies admitem UPDATE por admin desde a migration
 * 20260723141937, mas nada na UI lia nem gravava — os alertas que o admin vê
 * em ReaperHistoryPanel eram disparados por valores que ele não podia ajustar.
 */
export function ReaperAlertSettingsCard() {
  const settings = useReaperAlertSettings();
  const salvar = useUpdateReaperAlertSettings();
  const [form, setForm] = useState<ReaperAlertSettingsInput>(REAPER_SETTINGS_DEFAULTS);

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      enabled: settings.data.enabled,
      consecutive: settings.data.consecutive,
      min_dead_per_run: settings.data.min_dead_per_run,
      no_run_hours: settings.data.no_run_hours,
      cooldown_hours: settings.data.cooldown_hours,
    });
  }, [settings.data]);

  const erros = useMemo(() => validarAjustesReaper(form), [form]);

  const alterado = useMemo(() => {
    if (!settings.data) return false;
    return (
      form.enabled !== settings.data.enabled ||
      form.consecutive !== settings.data.consecutive ||
      form.min_dead_per_run !== settings.data.min_dead_per_run ||
      form.no_run_hours !== settings.data.no_run_hours ||
      form.cooldown_hours !== settings.data.cooldown_hours
    );
  }, [form, settings.data]);

  const invalido = Object.keys(erros).length > 0;

  const enviar = () => {
    salvar.mutate(form, {
      onSuccess: () => toast.success("Limiares do reaper atualizados"),
      onError: (e: Error) =>
        toast.error("Não foi possível salvar os limiares", { description: e.message }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-primary" aria-hidden="true" />
          Quando o reaper deve alertar
          {settings.data && (
            <Badge variant={settings.data.enabled ? "secondary" : "outline"}>
              {settings.data.enabled ? "alertas ligados" : "alertas desligados"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Estes valores controlam os alertas mostrados acima. Só administradores veem e alteram esta
          configuração.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PainelComEstado
          carregando={settings.isLoading}
          falhou={settings.isError}
          mensagemErro={
            settings.error?.message
              ? `Não foi possível carregar os limiares do reaper: ${settings.error.message}`
              : "Não foi possível carregar os limiares do reaper."
          }
          aoTentarNovamente={() => settings.refetch()}
          vazio={!settings.data}
          conteudoVazio={
            <p className="text-sm text-muted-foreground">
              Nenhuma linha de configuração encontrada em <code>reaper_alert_settings</code> — o cron
              usa os valores padrão (1 execução, 1 tarefa morta, 2 h sem rodar, 6 h de intervalo).
            </p>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="reaper-enabled" className="text-sm font-medium">
                  Alertas ativos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligado, o cron continua recuperando tarefas mas não registra nem notifica.
                </p>
              </div>
              <Switch
                id="reaper-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((campo) => (
                <div key={campo.key} className="space-y-1">
                  <Label htmlFor={`reaper-${campo.key}`} className="text-sm font-medium">
                    {campo.label}
                  </Label>
                  <Input
                    id={`reaper-${campo.key}`}
                    type="number"
                    inputMode="numeric"
                    min={REAPER_SETTINGS_LIMITS[campo.key].min}
                    max={REAPER_SETTINGS_LIMITS[campo.key].max ?? undefined}
                    value={form[campo.key]}
                    aria-invalid={!!erros[campo.key]}
                    aria-describedby={`reaper-${campo.key}-hint`}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [campo.key]: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                  />
                  <p
                    id={`reaper-${campo.key}-hint`}
                    className={
                      erros[campo.key]
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {erros[campo.key] ?? campo.hint}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-2"
                onClick={enviar}
                disabled={!alterado || invalido || salvar.isPending}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {salvar.isPending ? "Salvando…" : "Salvar limiares"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => settings.data && setForm({ ...settings.data })}
                disabled={!alterado || salvar.isPending}
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Descartar alterações
              </Button>
              {settings.data && (
                <span className="text-xs text-muted-foreground">
                  Última alteração: {new Date(settings.data.updated_at).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>
        </PainelComEstado>
      </CardContent>
    </Card>
  );
}