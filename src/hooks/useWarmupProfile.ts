import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

/**
 * Aquecimento (warm-up) de dominio para envio de campanhas.
 *
 * Sem perfil configurado o dispatcher nao aplica teto (`no_profile`). Com
 * perfil, `get_warmup_slot` barra o envio diario acima do limite, fora da
 * janela de horario e em dias nao permitidos.
 */
export interface WarmupProfile {
  id: string;
  organization_id: string;
  start_per_day: number;
  daily_increment: number;
  max_per_day: number;
  ramp_days: number;
  allowed_weekdays: number[];
  send_window_start: number;
  send_window_end: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarmupState {
  campaign_id: string;
  current_day: number;
  emails_sent_today: number;
  last_reset_date: string;
}

export interface WarmupInput {
  start_per_day: number;
  daily_increment: number;
  max_per_day: number;
  ramp_days: number;
  allowed_weekdays: number[];
  send_window_start: number;
  send_window_end: number;
  enabled: boolean;
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Limite do dia para um dia do ramp-up: start + incremento*(dia-1), truncado em max. */
export function dailyLimitFor(profile: Pick<WarmupProfile, "start_per_day" | "daily_increment" | "max_per_day" | "ramp_days">, day: number) {
  const d = Math.min(Math.max(day, 1), profile.ramp_days);
  return Math.min(profile.start_per_day + profile.daily_increment * (d - 1), profile.max_per_day);
}

function validate(input: WarmupInput) {
  if (!Number.isInteger(input.start_per_day) || input.start_per_day < 1) return "Envios no dia 1 deve ser >= 1.";
  if (!Number.isInteger(input.daily_increment) || input.daily_increment < 0) return "Incremento diário inválido.";
  if (!Number.isInteger(input.max_per_day) || input.max_per_day < input.start_per_day) return "Teto diário deve ser >= envios do dia 1.";
  if (!Number.isInteger(input.ramp_days) || input.ramp_days < 1) return "Duração do ramp-up deve ser >= 1 dia.";
  if (input.allowed_weekdays.length === 0) return "Selecione ao menos um dia da semana.";
  if (input.send_window_start === input.send_window_end) return "Janela de envio não pode ter início igual ao fim.";
  return null;
}

export function useWarmupProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["warmup-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("warmup_profiles")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as WarmupProfile | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (input: WarmupInput) => {
      const problem = validate(input);
      if (problem) throw new Error(problem);
      const existing = profileQuery.data;
      if (existing) {
        const { error } = await db
          .from("warmup_profiles")
          .update(input as never)
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await db.from("warmup_profiles").insert([input] as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warmup-profile"] });
      toast.success("Configuração de aquecimento salva.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("warmup_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warmup-profile"] });
      toast.success("Aquecimento desativado: envio sem teto diário.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desativar."),
  });

  return { ...profileQuery, save, remove };
}
