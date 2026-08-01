import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Settings = {
  id: string;
  enabled: boolean;
  window_hours: number;
  breach_pct: number;
  min_sample: number;
  cooldown_hours: number;
};

/**
 * Card admin para ajustar `sla_alert_settings`.
 * RLS restringe SELECT/UPDATE a admins globais — para não-admins, o botão apenas
 * não retorna dados e a UI mostra estado vazio silenciosamente.
 */
export function SlaAlertSettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sla-alert-settings"],
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase
        .from("sla_alert_settings")
        .select("id, enabled, window_hours, breach_pct, min_sample, cooldown_hours")
        .limit(1)
        .maybeSingle();
      if (error) return null; // não-admin: RLS bloqueia; UI oculta form
      return (data ?? null) as Settings | null;
    },
    staleTime: 30_000,
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Settings) => {
      const { error } = await supabase
        .from("sla_alert_settings")
        .update({
          enabled: payload.enabled,
          window_hours: payload.window_hours,
          breach_pct: payload.breach_pct,
          min_sample: payload.min_sample,
          cooldown_hours: payload.cooldown_hours,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-alert-settings"] });
      toast.success("Configurações de alerta SLA atualizadas");
    },
    onError: (e: Error) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  if (!isLoading && !data) return null; // sem permissão ou sem row

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings2 className="h-3.5 w-3.5" />
          Alertas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Alertas de SLA</h4>
          <p className="text-xs text-muted-foreground">
            Threshold, janela e cooldown do cron horário.
          </p>
        </div>

        {!form ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="sla-enabled" className="text-xs">
                Alertas ativos
              </Label>
              <Switch
                id="sla-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sla-window" className="text-xs">
                  Janela (h)
                </Label>
                <Input
                  id="sla-window"
                  type="number"
                  min={1}
                  max={168}
                  value={form.window_hours}
                  onChange={(e) =>
                    setForm({ ...form, window_hours: Number(e.target.value) })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sla-breach" className="text-xs">
                  Breach (%)
                </Label>
                <Input
                  id="sla-breach"
                  type="number"
                  min={1}
                  max={100}
                  step="0.1"
                  value={form.breach_pct}
                  onChange={(e) =>
                    setForm({ ...form, breach_pct: Number(e.target.value) })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sla-sample" className="text-xs">
                  Amostra mín.
                </Label>
                <Input
                  id="sla-sample"
                  type="number"
                  min={1}
                  max={10000}
                  value={form.min_sample}
                  onChange={(e) =>
                    setForm({ ...form, min_sample: Number(e.target.value) })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sla-cooldown" className="text-xs">
                  Cooldown (h)
                </Label>
                <Input
                  id="sla-cooldown"
                  type="number"
                  min={1}
                  max={168}
                  value={form.cooldown_hours}
                  onChange={(e) =>
                    setForm({ ...form, cooldown_hours: Number(e.target.value) })
                  }
                  className="h-8"
                />
              </div>
            </div>

            <Button
              className="w-full h-8"
              size="sm"
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
