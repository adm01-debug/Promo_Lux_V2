import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReaperAlertSettings {
  id: string;
  enabled: boolean;
  consecutive: number;
  min_dead_per_run: number;
  no_run_hours: number;
  cooldown_hours: number;
  updated_at: string;
}

/** Campos ajustáveis pelo admin (o resto da linha é singleton/auditoria). */
export type ReaperAlertSettingsInput = Pick<
  ReaperAlertSettings,
  "enabled" | "consecutive" | "min_dead_per_run" | "no_run_hours" | "cooldown_hours"
>;

export type ReaperAlertSettingsErrors = Partial<Record<keyof ReaperAlertSettingsInput, string>>;

/** Faixas espelham os CHECKs da migration 20260723141937. */
export const REAPER_SETTINGS_LIMITS = {
  consecutive: { min: 1, max: 20 },
  min_dead_per_run: { min: 0, max: null },
  no_run_hours: { min: 1, max: 168 },
  cooldown_hours: { min: 1, max: 168 },
} as const;

export const REAPER_SETTINGS_DEFAULTS: ReaperAlertSettingsInput = {
  enabled: true,
  consecutive: 1,
  min_dead_per_run: 1,
  no_run_hours: 2,
  cooldown_hours: 6,
};

function dentroDaFaixa(
  value: number,
  limites: { min: number; max: number | null },
  rotulo: string,
): string | undefined {
  if (!Number.isInteger(value)) return `${rotulo} precisa ser um número inteiro.`;
  if (value < limites.min) return `${rotulo} mínimo é ${limites.min}.`;
  if (limites.max !== null && value > limites.max) {
    return `${rotulo} máximo é ${limites.max}.`;
  }
  return undefined;
}

/**
 * Valida antes de enviar: sem isso o banco recusaria com erro de CHECK e o
 * admin não saberia qual campo está fora da faixa.
 */
export function validarAjustesReaper(
  input: ReaperAlertSettingsInput,
): ReaperAlertSettingsErrors {
  const erros: ReaperAlertSettingsErrors = {};
  const checks: Array<[keyof typeof REAPER_SETTINGS_LIMITS, string]> = [
    ["consecutive", "Execuções consecutivas"],
    ["min_dead_per_run", "Mínimo de tarefas mortas"],
    ["no_run_hours", "Horas sem execução"],
    ["cooldown_hours", "Intervalo entre alertas"],
  ];
  for (const [campo, rotulo] of checks) {
    const erro = dentroDaFaixa(input[campo], REAPER_SETTINGS_LIMITS[campo], rotulo);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

const SETTINGS_COLUMNS =
  "id, enabled, consecutive, min_dead_per_run, no_run_hours, cooldown_hours, updated_at";

/**
 * Limiares do cron `reaper-alerts` (tabela global, sem organization_id).
 * SELECT/UPDATE liberados por RLS apenas para quem tem o papel global `admin`.
 */
export function useReaperAlertSettings(enabled = true) {
  return useQuery({
    queryKey: ["reaper-alert-settings"],
    enabled,
    queryFn: async (): Promise<ReaperAlertSettings | null> => {
      const { data, error } = await supabase
        .from("reaper_alert_settings")
        .select(SETTINGS_COLUMNS)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as ReaperAlertSettings | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useUpdateReaperAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReaperAlertSettingsInput) => {
      const erros = validarAjustesReaper(input);
      if (Object.keys(erros).length > 0) {
        throw new Error(Object.values(erros)[0]);
      }
      const { data, error } = await supabase
        .from("reaper_alert_settings")
        .update({
          enabled: input.enabled,
          consecutive: input.consecutive,
          min_dead_per_run: input.min_dead_per_run,
          no_run_hours: input.no_run_hours,
          cooldown_hours: input.cooldown_hours,
        })
        .eq("singleton", true)
        .select(SETTINGS_COLUMNS)
        .single();
      if (error) throw error;
      return data as ReaperAlertSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaper-alert-settings"] });
    },
  });
}