import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "sonner";

export type NbaActionType =
  | "follow_up"
  | "call"
  | "email"
  | "linkedin"
  | "meeting"
  | "proposal"
  | "reengage"
  | "close";

export type NbaChannel = "email" | "phone" | "linkedin" | "in_person";

export interface NextBestActionRow {
  id: string;
  deal_id: string;
  deal_title: string | null;
  deal_value: number | null;
  stage_name: string | null;
  stakeholder_id: string | null;
  stakeholder_name: string | null;
  stakeholder_email: string | null;
  stakeholder_phone: string | null;
  stakeholder_linkedin: string | null;
  action_type: NbaActionType;
  channel: NbaChannel;
  priority: number;
  reason: string;
  days_since_contact: number | null;
  win_probability: number | null;
  suggested_at: string;
  dismissed_at: string | null;
}

export const NBA_ACTION_LABEL: Record<NbaActionType, string> = {
  follow_up: "Retomar conversa",
  call: "Ligar",
  email: "Enviar e-mail",
  linkedin: "Abordar no LinkedIn",
  meeting: "Agendar reuniao",
  proposal: "Enviar proposta",
  reengage: "Reengajar",
  close: "Pedir fechamento",
};

export const NBA_CHANNEL_LABEL: Record<NbaChannel, string> = {
  email: "E-mail",
  phone: "Telefone",
  linkedin: "LinkedIn",
  in_person: "Presencial",
};

/** Fila priorizada de proximas melhores acoes da organizacao ativa. */
export function useNextBestActions(includeDismissed = false) {
  const { activeOrgId } = useActiveOrganization();

  return useQuery({
    queryKey: ["next_best_actions", activeOrgId, includeDismissed],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_next_best_actions", {
        _org_id: activeOrgId!,
        _limit: 100,
        _include_dismissed: includeDismissed,
      });
      if (error) throw error;
      return (data ?? []) as NextBestActionRow[];
    },
  });
}

/** Recalcula as sugestoes a partir dos dados atuais de deals e atividades. */
export function useRefreshNextBestActions() {
  const { activeOrgId } = useActiveOrganization();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Organizacao ativa nao definida");
      const { data, error } = await supabase.rpc("refresh_next_best_actions", {
        _org_id: activeOrgId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["next_best_actions"] });
      toast.success(`${n} sugestoes recalculadas`);
    },
    onError: (e: Error) => toast.error(`Falha ao recalcular: ${e.message}`),
  });
}

/** Dispensa uma sugestao (nao volta no proximo recalculo). */
export function useDismissNextBestAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("dismiss_next_best_action", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next_best_actions"] });
      toast.success("Sugestao dispensada");
    },
    onError: (e: Error) => toast.error(`Falha ao dispensar: ${e.message}`),
  });
}