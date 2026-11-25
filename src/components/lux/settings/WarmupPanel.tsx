import { useEffect, useState } from "react";
import { Flame, Loader2, Save, Trash2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  WEEKDAY_LABELS,
  dailyLimitFor,
  useWarmupProfile,
  type WarmupInput,
} from "@/hooks/useWarmupProfile";

const EMPTY: WarmupInput = {
  start_per_day: 20,
  daily_increment: 10,
  max_per_day: 200,
  ramp_days: 14,
  allowed_weekdays: [1, 2, 3, 4, 5],
  send_window_start: 9,
  send_window_end: 18,
  enabled: true,
};

/** Painel de aquecimento de domínio: teto diário de envio por organização. */
export function WarmupPanel() {
  const { data: profile, isLoading, save, remove } = useWarmupProfile();
  const [form, setForm] = useState<WarmupInput>(EMPTY);

  useEffect(() => {
    if (!profile) return;
    setForm({
      start_per_day: profile.start_per_day,
      daily_increment: profile.daily_increment,
      max_per_day: profile.max_per_day,
      ramp_days: profile.ramp_days,
      allowed_weekdays: [...(profile.allowed_weekdays ?? [])].sort((a, b) => a - b),
      send_window_start: profile.send_window_start,
      send_window_end: profile.send_window_end,
      enabled: profile.enabled,
    });
  }, [profile]);

  const set = <K extends keyof WarmupInput>(key: K, value: WarmupInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleWeekday = (day: number) => {
    const current = new Set(form.allowed_weekdays);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    set("allowed_weekdays", [...current].sort((a, b) => a - b));
  };

  const day1 = dailyLimitFor(form, 1);
  const plateau = dailyLimitFor(form, form.ramp_days);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-lg font-semibold text-foreground">Aquecimento de Domínio</h3>
          {profile ? (
            <Badge variant={profile.enabled ? "default" : "secondary"}>
              {profile.enabled ? "Ativo" : "Desativado"}
            </Badge>
          ) : (
            <Badge variant="secondary">Sem teto</Badge>
          )}
        </div>
        {profile && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(profile.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
            Remover
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Limita quantos e-mails cada campanha envia por dia e cresce aos poucos. Sem configuração,
        o envio não tem teto diário — um domínio novo enviando de uma vez derruba a entregabilidade
        de todas as campanhas.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="warmup-start">Envios no dia 1</Label>
              <Input
                id="warmup-start"
                type="number"
                min={1}
                value={form.start_per_day}
                onChange={(e) => set("start_per_day", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warmup-inc">Aumento por dia</Label>
              <Input
                id="warmup-inc"
                type="number"
                min={0}
                value={form.daily_increment}
                onChange={(e) => set("daily_increment", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warmup-max">Teto diário</Label>
              <Input
                id="warmup-max"
                type="number"
                min={1}
                value={form.max_per_day}
                onChange={(e) => set("max_per_day", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warmup-days">Duração (dias)</Label>
              <Input
                id="warmup-days"
                type="number"
                min={1}
                value={form.ramp_days}
                onChange={(e) => set("ramp_days", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias permitidos</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const on = form.allowed_weekdays.includes(day);
                return (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() => toggleWeekday(day)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warmup-from">Janela de envio — início (UTC)</Label>
              <Input
                id="warmup-from"
                type="number"
                min={0}
                max={23}
                value={form.send_window_start}
                onChange={(e) => set("send_window_start", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warmup-to">Janela de envio — fim (UTC)</Label>
              <Input
                id="warmup-to"
                type="number"
                min={0}
                max={23}
                value={form.send_window_end}
                onChange={(e) => set("send_window_end", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Aplicar teto no envio</p>
              <p className="text-xs text-muted-foreground">
                Desligado, o dispatcher ignora o perfil e envia sem limite diário.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
              aria-label="Aplicar teto no envio"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Dia 1: <strong className="text-foreground">{day1}</strong> e-mails · no dia {form.ramp_days}:{" "}
              <strong className="text-foreground">{plateau}</strong> e-mails/dia. Daí em diante o limite
              fica estável.
            </span>
          </div>

          <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
            {save.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1 h-4 w-4" aria-hidden />
            )}
            Salvar aquecimento
          </Button>
        </div>
      )}
    </div>
  );
}
