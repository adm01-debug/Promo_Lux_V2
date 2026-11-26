import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import type { Json } from "@/integrations/supabase/types";
import type { SequenceStep } from "@/components/lux/campaigns/CampaignFormFields";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "sonner";

export type EmailTemplate = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  subject: string | null;
  body: string | null;
  sequence: SequenceStep[] | null;
  variables: string[];
  tags: string[];
  usage_count: number;
  last_used_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type EmailTemplateInput = {
  name: string;
  description?: string | null;
  category?: string;
  subject?: string | null;
  body?: string | null;
  sequence?: SequenceStep[] | null;
  variables?: string[];
  tags?: string[];
};

export type EmailTemplateStat = {
  category: string | null;
  templates: number | null;
  usados: number | null;
  usos_totais: number | null;
  ultimo_uso: string | null;
};

export const TEMPLATE_CATEGORIES = [
  "prospeccao",
  "follow-up",
  "reuniao",
  "proposta",
  "reativacao",
  "geral",
] as const;

/** Variaveis suportadas pela interpolacao do campaign-dispatch. */
export const TEMPLATE_VARIABLES = [
  "{{empresa}}",
  "{{contato}}",
  "{{cargo}}",
  "{{cidade}}",
  "{{segmento}}",
  "{{remetente}}",
] as const;

function normalize(row: Record<string, unknown>): EmailTemplate {
  return {
    ...(row as Omit<EmailTemplate, "sequence">),
    sequence: Array.isArray(row.sequence) ? (row.sequence as SequenceStep[]) : null,
  };
}

export function useEmailTemplates() {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["email-templates", activeOrgId],
    // O wrapper falha fechado sem organizacao ativa (MissingOrgContextError).
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("email_templates")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function useEmailTemplateStats() {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["email-template-stats", activeOrgId],
    queryFn: async () => {
      // View agregada (`email_template_stats`): security_invoker + RLS da tabela base.
      const { data, error } = await supabase.from("email_template_stats").select("*");
      if (error) throw error;
      return (data ?? []) as EmailTemplateStat[];
    },
  });
}

export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: EmailTemplateInput & { id?: string }) => {
      const payload = {
        name: input.name.trim(),
        description: input.description ?? null,
        category: input.category ?? "geral",
        subject: input.subject ?? null,
        body: input.body ?? null,
        sequence: (input.sequence ?? null) as Json | null,
        variables: input.variables ?? [],
        tags: input.tags ?? [],
      };
      if (id) {
        const { error } = await db.from("email_templates").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await db
        .from("email_templates")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      qc.invalidateQueries({ queryKey: ["email-template-stats"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar o modelo", { description: e.message }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // soft delete: o historico de uso continua auditavel
      const { error } = await db
        .from("email_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      qc.invalidateQueries({ queryKey: ["email-template-stats"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir o modelo", { description: e.message }),
  });
}

export function useDuplicateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("duplicate_email_template", {
        _template_id: id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      qc.invalidateQueries({ queryKey: ["email-template-stats"] });
    },
    onError: (e: Error) => toast.error("Não foi possível duplicar o modelo", { description: e.message }),
  });
}

/** Incrementa usage_count. Best-effort: falhar aqui nao deve travar o envio. */
export async function markEmailTemplateUsed(id: string) {
  const { error } = await supabase.rpc("mark_email_template_used", { _template_id: id });
  if (error) console.warn("markEmailTemplateUsed", error.message);
}