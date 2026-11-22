import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "@/hooks/use-toast";

export type SurveyKind = "nps" | "csat";

export interface SurveyStats {
  survey_id: string;
  organization_id: string;
  name: string;
  kind: SurveyKind;
  scale_max: number;
  responses: number;
  avg_score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  pending: number;
  active: boolean;
  score_index: number | null;
}

export const KIND_LABEL: Record<SurveyKind, string> = {
  nps: "NPS",
  csat: "CSAT",
};

export function useSurveys() {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["satisfaction-stats", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("satisfaction_stats")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SurveyStats[];
    },
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (input: { name: string; kind: SurveyKind; question: string }) => {
      const { data, error } = await supabase
        .from("satisfaction_surveys")
        .insert({
          ...input,
          organization_id: activeOrgId!,
          scale_max: input.kind === "nps" ? 10 : 5,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-stats"] });
      toast({ title: "Pesquisa criada" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao criar pesquisa", description: e.message, variant: "destructive" }),
  });
}

export function useToggleSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("satisfaction_surveys").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["satisfaction-stats"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("satisfaction_surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["satisfaction-stats"] });
      toast({ title: "Pesquisa removida" });
    },
    onError: (e: Error) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });
}

/** Registra uma resposta e devolve o link publico para enviar ao cliente. */
export function useCreateSurveyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      survey_id: string;
      organization_id: string;
      contact_email?: string;
      company_id?: string;
    }) => {
      // score 0 e placeholder: a linha existe para gerar o token, e o cliente
      // sobrescreve ao responder. Mantemos NOT NULL para o link funcionar.
      const { data, error } = await supabase
        .from("satisfaction_responses")
        .insert({ ...input, score: null, comment: null, responded_at: null })
        .select("token")
        .single();
      if (error) throw error;
      return `${window.location.origin}/survey/${data.token}`;
    },
    onSuccess: (url) => {
      navigator.clipboard?.writeText(url);
      qc.invalidateQueries({ queryKey: ["satisfaction-stats"] });
      toast({ title: "Link copiado", description: url });
    },
    onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
  });
}

export interface PublicSurvey {
  name: string;
  kind: SurveyKind;
  question: string;
  scale_max: number;
  answered: boolean;
  score: number | null;
  comment: string | null;
}

/** Leitura publica pelo token (RPC SECURITY DEFINER, nao exige login). */
export async function fetchSurveyByToken(token: string): Promise<PublicSurvey | null> {
  const { data, error } = await supabase.rpc("get_survey_by_token", { _token: token });
  if (error) return null;
  return (data as unknown as PublicSurvey) ?? null;
}

/** Resposta publica. Valida token, escala e idempotencia no banco. */
export async function submitSurveyResponse(token: string, score: number, comment?: string) {
  const { error } = await supabase.rpc("submit_survey_response", {
    _token: token,
    _score: score,
    _comment: comment,
  });
  if (error) throw error;
}