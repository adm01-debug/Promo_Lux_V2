import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCnpj, isValidCnpj } from "@/lib/cnpj";

export interface CnpjPartner {
  name: string | null;
  role: string | null;
  since: string | null;
}

export interface CnpjActivity {
  code: string | null;
  text: string | null;
}

export interface CnpjEnrichData {
  cnpj: string;
  name: string | null;
  alias: string | null;
  founded: string | null;
  status: string | null;
  equity: number | null;
  size: string | null;
  sector: string | null;
  cnae_code: string | null;
  cnae_text: string | null;
  activities: string[];
  activities_full: CnpjActivity[];
  members: CnpjPartner[];
  location: string | null;
  address: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
}

export type CnpjEnrichStatus = "idle" | "loading" | "success" | "not_found" | "invalid" | "error";

interface EnrichResponse {
  source?: string;
  data?: CnpjEnrichData;
  error?: string;
}

/**
 * Consulta a edge function `cnpj-enrich` para enriquecer dados a partir do CNPJ.
 * Requer 14 dígitos (validação matemática ocorre no backend).
 */
export function useCnpjEnrich() {
  const [status, setStatus] = useState<CnpjEnrichStatus>("idle");
  const [data, setData] = useState<CnpjEnrichData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setData(null);
    setErrorMsg(null);
  }, []);

  const enrich = useCallback(async (cnpj: string): Promise<CnpjEnrichData | null> => {
    const digits = normalizeCnpj(cnpj);
    if (!isValidCnpj(digits)) {
      setStatus("invalid");
      setData(null);
      setErrorMsg(
        digits.length !== 14
          ? "CNPJ deve conter 14 dígitos."
          : "CNPJ inválido (dígitos verificadores não conferem).",
      );
      return null;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const { data: resp, error } = await supabase.functions.invoke<EnrichResponse>("cnpj-enrich", {
        body: { cnpj: digits },
      });
      if (ctrl.signal.aborted) return null;

      if (error) {
        // Supabase FunctionsHttpError carrega status; tratar 404 como not_found.
        const ctx = (error as { context?: { status?: number } }).context;
        if (ctx?.status === 404) {
          setStatus("not_found");
          return null;
        }
        if (ctx?.status === 400) {
          setStatus("invalid");
          return null;
        }
        setStatus("error");
        setErrorMsg(error.message);
        return null;
      }

      if (resp?.data) {
        setData(resp.data);
        setStatus("success");
        return resp.data;
      }
      setStatus("error");
      setErrorMsg("Resposta vazia do serviço.");
      return null;
    } catch (err) {
      if (ctrl.signal.aborted) return null;
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    }
  }, []);

  return { status, data, errorMsg, enrich, reset };
}
