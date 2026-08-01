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

export type CnpjEnrichStatus =
  | "idle"
  | "loading"
  | "queued"
  | "success"
  | "not_found"
  | "invalid"
  | "error";

interface EnrichResponse {
  source?: string;
  data?: CnpjEnrichData;
  error?: string;
  cached?: boolean;
  queued?: boolean;
  job_id?: string | null;
  reason?: string;
}

// Polling da fila em caso de resposta 202 (rate-limited / provider transitório).
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

async function pollJob(
  jobId: string,
  signal: AbortSignal,
): Promise<{ status: "completed" | "failed" | "not_found" | "timeout"; result: CnpjEnrichData | null; error: string | null }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) return { status: "timeout", result: null, error: "aborted" };
    const { data, error } = await supabase
      .from("cnpj_enrich_queue")
      .select("status,result,last_error")
      .eq("id", jobId)
      .maybeSingle();
    if (error) return { status: "failed", result: null, error: error.message };
    if (data?.status === "completed") {
      return { status: "completed", result: (data.result as unknown as CnpjEnrichData) ?? null, error: null };
    }
    if (data?.status === "failed") {
      return { status: "failed", result: null, error: data.last_error ?? "job_failed" };
    }
    if (data?.status === "not_found") {
      return { status: "not_found", result: null, error: null };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { status: "timeout", result: null, error: "poll_timeout" };
}

/**
 * Consulta a edge function `cnpj-enrich` para enriquecer dados a partir do CNPJ.
 * Suporta cache com TTL e fila de reprocessamento (respostas 202).
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

      // 202 → job enfileirado; supabase-js entrega o body normalmente aqui.
      if (resp?.queued && resp.job_id) {
        setStatus("queued");
        setErrorMsg(
          resp.reason === "rate_limited"
            ? "Limite do provedor atingido — reprocessando em segundo plano."
            : "Provedor instável — reprocessando em segundo plano.",
        );
        const outcome = await pollJob(resp.job_id, ctrl.signal);
        if (ctrl.signal.aborted) return null;
        if (outcome.status === "completed" && outcome.result) {
          setData(outcome.result);
          setStatus("success");
          setErrorMsg(null);
          return outcome.result;
        }
        if (outcome.status === "not_found") {
          setStatus("not_found");
          return null;
        }
        setStatus("error");
        setErrorMsg(outcome.error ?? "Falha ao processar CNPJ.");
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
