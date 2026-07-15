import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================================
// Oracle v2 — hooks para as edges oracle-* (busca + enriquecimento)
// Toda a automação roda dentro do LUX, sem gastar crédito Lusha pago.
// Cookies vêm do vault self-hosted (mesma fonte do n8n).
// ============================================================================

export interface OracleServiceReport {
  servico: "lusha" | "leadcontact" | "linkedin";
  present: boolean;
  ready: boolean;
  health_status: string | null;
  expires_in_minutes: number | null;
  updated_minutes_ago: number | null;
  error: string | null;
}

export interface OraclePreflightResponse {
  ok: boolean;
  services: OracleServiceReport[];
  correlation_id: string;
  duration_ms: number;
}

export function useOraclePreflight() {
  return useQuery<OraclePreflightResponse>({
    queryKey: ["oracle", "preflight"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<OraclePreflightResponse>(
        "oracle-cookies-preflight",
        { method: "GET" },
      );
      if (error) throw error;
      return data!;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
}

export interface SearchDecisorsInput {
  company_name: string;
  departments: string[];
  organization_id: string;
  company_id?: string;
  max_per_department?: number;
}

export interface SearchDecisorsResponse {
  session_id: string;
  company: { id: string | number; name: string };
  total_found: number;
  inserted: number;
  duplicates: number;
  errors: Array<{ department: string; error: string }>;
  departments_mapped: string[];
  departments_not_found: string[];
  correlation_id: string;
  warning?: string;
}

export function useOracleSearchDecisors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SearchDecisorsInput): Promise<SearchDecisorsResponse> => {
      const { data, error } = await supabase.functions.invoke<SearchDecisorsResponse>(
        "oracle-search-decisors",
        { body: input },
      );
      if (error) throw error;
      return data!;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["lusha", "contacts"] });
      qc.invalidateQueries({ queryKey: ["lusha", "sessions"] });
      if (data.warning === "company_not_found") {
        toast.warning("Empresa não encontrada na Lusha.");
      } else {
        toast.success(
          `${data.inserted} decisor(es) encontrado(s)${data.duplicates > 0 ? ` (+${data.duplicates} duplicados)` : ""}.`,
        );
      }
    },
    onError: (err: Error) => toast.error(`Busca de decisores falhou: ${err.message}`),
  });
}

export interface EnrichContactInput {
  contact_ids: string[];
}

export interface EnrichResultItem {
  contact_id: string;
  status: "enriched" | "not_found" | "error_auth" | "error_rate_limit" | "error_other" | "skipped";
  email?: string | null;
  phone?: string | null;
  error?: string;
}

export interface EnrichContactResponse {
  results: EnrichResultItem[];
  summary: {
    enriched: number;
    not_found: number;
    error_auth: number;
    error_rate_limit: number;
    error_other: number;
    skipped: number;
  };
  skipped: string[];
  correlation_id: string;
}

export function useOracleEnrichContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnrichContactInput): Promise<EnrichContactResponse> => {
      const { data, error } = await supabase.functions.invoke<EnrichContactResponse>(
        "oracle-enrich-contact",
        { body: input },
      );
      if (error) throw error;
      return data!;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["lusha", "contacts"] });
      const { enriched, not_found, error_auth, error_rate_limit, error_other } = data.summary;
      if (error_auth > 0) {
        toast.error("Cookie LeadContact expirou. Renove no vault.");
      } else if (error_rate_limit > 0) {
        toast.warning(`Rate limit atingido. ${enriched} enriquecidos, ${error_rate_limit} pendentes.`);
      } else {
        toast.success(
          `${enriched} enriquecido(s)${not_found > 0 ? `, ${not_found} sem dado` : ""}${error_other > 0 ? `, ${error_other} erro(s)` : ""}.`,
        );
      }
    },
    onError: (err: Error) => toast.error(`Enriquecimento falhou: ${err.message}`),
  });
}
