import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Lista de supressão de e-mail (LGPD / boas práticas de envio).
 *
 * Endereços aqui NUNCA devem receber campanhas. As entradas são criadas
 * automaticamente por triggers (`sync_suppression_from_recipient`) quando um
 * destinatário faz unsubscribe ou sofre bounce, e podem ser adicionadas
 * manualmente pela equipe (reason = 'manual').
 */
export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "manual";

export interface EmailSuppression {
  id: string;
  organization_id: string;
  email: string;
  reason: SuppressionReason;
  source_campaign_id: string | null;
  source_recipient_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  unsubscribe: "Descadastro",
  bounce: "Bounce",
  complaint: "Reclamação (spam)",
  manual: "Manual",
};

export function useEmailSuppressions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["email-suppressions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("email_suppressions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailSuppression[];
    },
  });

  const addSuppression = useMutation({
    mutationFn: async (input: { email: string; notes?: string }) => {
      const email = input.email.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Informe um e-mail válido.");
      }
      // `organization_id` é injetado automaticamente pelo wrapper `db` (withOrg).
      const { error } = await db.from("email_suppressions").insert([{
        email,
        reason: "manual",
        notes: input.notes?.trim() || null,
      }] as never);
      // Conflito de único (org + email) = já suprimido; tratamos como sucesso idempotente.
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-suppressions"] });
      toast.success("E-mail adicionado à lista de supressão.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar."),
  });

  const removeSuppression = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("email_suppressions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-suppressions"] });
      toast.success("E-mail removido da lista de supressão.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  return { ...query, addSuppression, removeSuppression };
}
