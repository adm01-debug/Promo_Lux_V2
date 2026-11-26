import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "sonner";

export type PiiCategory =
  | "email"
  | "phone"
  | "cpf"
  | "cnpj"
  | "credit_card"
  | "secret";

export type PiiAction = "mask" | "redact" | "hash";

export interface PiiRule {
  category: PiiCategory;
  action: PiiAction;
  enabled: boolean;
}

export interface PiiScanRow {
  table_name: string;
  column_name: string;
  category: PiiCategory;
  rows_total: number;
  rows_with_pii: number;
}

export const PII_CATEGORY_LABEL: Record<PiiCategory, string> = {
  email: "E-mail",
  phone: "Telefone",
  cpf: "CPF",
  cnpj: "CNPJ",
  credit_card: "Cartao de credito",
  secret: "Token / segredo",
};

export const PII_ACTION_LABEL: Record<PiiAction, string> = {
  mask: "Mascarar",
  redact: "Remover",
  hash: "Pseudonimizar",
};

/** Regras ligadas: sao as unicas que mudam de fato o que sai do sistema. */
export function regrasAtivasPii(rules: PiiRule[] | undefined | null): PiiRule[] {
  return (rules ?? []).filter((r) => r.enabled);
}

/**
 * Resumo do que o mascaramento vai fazer no proximo arquivo exportado.
 * Devolve string vazia quando nao ha regra ligada (nenhum efeito).
 */
export function resumoMascaramentoPii(rules: PiiRule[] | undefined | null): string {
  const ativas = regrasAtivasPii(rules);
  if (ativas.length === 0) return "";

  const acoes = [
    ...new Set(ativas.map((r) => PII_ACTION_LABEL[r.action] ?? r.action)),
  ]
    .join(", ")
    .toLowerCase();
  const categorias = ativas
    .map((r) => PII_CATEGORY_LABEL[r.category] ?? r.category)
    .join(", ");

  return `${ativas.length} regra(s) ativa(s) — ${acoes}: ${categorias}`;
}

export function usePiiRules() {
  const { activeOrgId } = useActiveOrganization();
  const qc = useQueryClient();

  const rules = useQuery({
    queryKey: ["pii-rules", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<PiiRule[]> => {
      const { data, error } = await supabase.rpc("list_pii_rules", {
        _org_id: activeOrgId!,
      });
      if (error) throw error;
      return (data ?? []) as PiiRule[];
    },
  });

  const setRule = useMutation({
    mutationFn: async (input: {
      category: PiiCategory;
      action: PiiAction;
      enabled: boolean;
    }) => {
      const { error } = await supabase.rpc("set_pii_rule", {
        _org_id: activeOrgId!,
        _category: input.category,
        _action: input.action,
        _enabled: input.enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pii-rules", activeOrgId] });
      toast.success("Regra de PII atualizada");
    },
    onError: (e: Error) =>
      toast.error("Erro ao salvar regra", { description: e.message }),
  });

  return { ...rules, setRule };
}

export function usePiiScan() {
  const { activeOrgId } = useActiveOrganization();

  return useMutation({
    mutationFn: async (): Promise<PiiScanRow[]> => {
      const { data, error } = await supabase.rpc("pii_scan", {
        _org_id: activeOrgId!,
      });
      if (error) throw error;
      return (data ?? []) as PiiScanRow[];
    },
    onError: (e: Error) =>
      toast.error("Erro ao varrer PII", { description: e.message }),
  });
}

export function usePiiPreview() {
  const { activeOrgId } = useActiveOrganization();

  return useMutation({
    mutationFn: async (text: string): Promise<string> => {
      if (!text.trim()) return "";
      const { data, error } = await supabase.rpc("pii_redact_text", {
        _org_id: activeOrgId!,
        _value: text,
      });
      if (error) throw error;
      return (data as string) ?? text;
    },
  });
}