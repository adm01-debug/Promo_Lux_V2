import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "sonner";

export type LostReasonCategory =
  | "price" | "competitor" | "timing" | "no_budget"
  | "no_fit" | "no_response" | "internal" | "other";

export interface LostReason {
  id: string;
  label: string;
  category: LostReasonCategory;
  active: boolean;
  position: number;
  created_at: string;
}

export interface LostReasonStat {
  lost_reason_id: string;
  label: string;
  category: LostReasonCategory;
  deal_count: number;
  total_value: number;
}

export const CATEGORY_LABEL: Record<LostReasonCategory, string> = {
  price: "Preço",
  competitor: "Concorrência",
  timing: "Timing",
  no_budget: "Sem orçamento",
  no_fit: "Fora do ICP",
  no_response: "Sem resposta",
  internal: "Interno",
  other: "Outro",
};

/** Catálogo de motivos de perda da organização. */
export function useLostReasons() {
  const { user } = useAuth();
  const { activeOrgId: orgId } = useActiveOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["deal_lost_reasons", orgId],
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("deal_lost_reasons")
        .select("id,label,category,active,position,created_at")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LostReason[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["deal_lost_reasons", orgId] });

  const createReason = useMutation({
    mutationFn: async (input: { label: string; category: LostReasonCategory }) => {
      const { error } = await db.from("deal_lost_reasons").insert({
        label: input.label.trim(),
        category: input.category,
        position: (query.data?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Motivo adicionado"); },
    onError: (e: Error) => toast.error("Erro ao adicionar motivo", { description: e.message }),
  });

  const updateReason = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LostReason> & { id: string }) => {
      const { error } = await db.from("deal_lost_reasons").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error("Erro ao atualizar motivo", { description: e.message }),
  });

  const deleteReason = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("deal_lost_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Motivo removido"); },
    onError: (e: Error) => toast.error("Erro ao remover motivo", { description: e.message }),
  });

  return {
    reasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createReason, updateReason, deleteReason,
  };
}

/** Contagem e valor perdido por motivo — alimenta o painel de análise. */
export function useLostReasonStats() {
  const { user } = useAuth();
  const { activeOrgId: orgId } = useActiveOrganization();

  return useQuery({
    queryKey: ["deal_lost_reason_stats", orgId],
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_lost_reason_stats")
        .select("lost_reason_id,label,category,deal_count,total_value")
        .order("deal_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LostReasonStat[];
    },
  });
}

/** Marcador de que o negócio foi perdido — usado no formulário de fechamento. */
export function isLostStage(stageType: "open" | "won" | "lost" | undefined) {
  return stageType === "lost";
}

/** Motivos canônicos semeados quando a organização ainda não tem catálogo. */
export const DEFAULT_LOST_REASONS: { label: string; category: LostReasonCategory }[] = [
  { label: "Preço acima do orçamento", category: "price" },
  { label: "Concorrente escolhido", category: "competitor" },
  { label: "Timing inadequado", category: "timing" },
  { label: "Sem orçamento no momento", category: "no_budget" },
  { label: "Fora do perfil ideal (ICP)", category: "no_fit" },
  { label: "Sem resposta do contato", category: "no_response" },
  { label: "Decisão interna contrária", category: "internal" },
  { label: "Outro", category: "other" },
];

/**
 * Garante que a organização tenha catálogo de motivos. Necessário para
 * organizações criadas depois da migration (o seed da migration cobre as
 * que já existiam).
 */
export function useLostReasonSeed() {
  const { user } = useAuth();
  const { activeOrgId: orgId } = useActiveOrganization();
  const qc = useQueryClient();
  const { reasons, isLoading } = useLostReasons();

  useEffect(() => {
    if (!user || !orgId || isLoading || reasons.length > 0) return;
    (async () => {
      const { error } = await db.from("deal_lost_reasons").insert(
        DEFAULT_LOST_REASONS.map((r, i) => ({
          label: r.label,
          category: r.category,
          position: i,
        })),
      );
      if (!error) qc.invalidateQueries({ queryKey: ["deal_lost_reasons", orgId] });
    })();
  }, [user, orgId, isLoading, reasons.length, qc]);
}