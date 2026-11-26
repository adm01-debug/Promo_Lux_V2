// _shared/lusha-credit-log.ts
//
// Registro de consumo de crédito da Lusha em public.lusha_credit_usage_log.
//
// A Lusha cobra crédito por contato revelado. A Edge Function recebe o custo
// na própria resposta da API (creditsCharged) e, sem gravar aqui, esse número
// morre no fim da requisição: não há como saber quanto cada organização
// consumiu (docs/qa/04-PLANO.md, etapa 149).
//
// Regra de ouro: a gravação acontece DEPOIS da resposta da API e nunca derruba
// a revelação — quando ela falha, o crédito já foi gasto.

export interface LushaCreditUsageRow {
  organization_id: string;
  endpoint: string;
  operation: string;
  api_version?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  bitrix_card_id?: string | null;
  company_name?: string | null;
  domain?: string | null;
  success?: boolean;
  credits_charged?: number;
  records_returned?: number;
  request_id?: string | null;
  error_code?: string | null;
}

/** Caminho da API Lusha consumido pelo reveal (v2 Person). */
export const LUSHA_REVEAL_ENDPOINT = "/v2/person";
export const LUSHA_REVEAL_OPERATION = "reveal";
export const LUSHA_REVEAL_API_VERSION = "v2";

export interface LushaRevealUsageInput {
  organizationId: string;
  userId?: string | null;
  requestId?: string | null;
  bitrixCardId?: string | null;
  creditsCharged?: number | string | null;
  recordsReturned?: number | string | null;
  success: boolean;
  errorCode?: string | null;
}

/**
 * Normaliza uma contagem vinda da API: pode faltar, vir em texto ou vir
 * negativa. As colunas são NOT NULL DEFAULT 0, então o retorno é sempre um
 * inteiro >= 0.
 */
export function toCreditCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

export function buildLushaRevealUsageRow(
  input: LushaRevealUsageInput,
): LushaCreditUsageRow {
  return {
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    endpoint: LUSHA_REVEAL_ENDPOINT,
    operation: LUSHA_REVEAL_OPERATION,
    api_version: LUSHA_REVEAL_API_VERSION,
    bitrix_card_id: input.bitrixCardId ?? null,
    success: input.success,
    credits_charged: toCreditCount(input.creditsCharged),
    records_returned: toCreditCount(input.recordsReturned),
    request_id: input.requestId ?? null,
    error_code: input.errorCode ?? null,
  };
}

/** Cliente mínimo necessário: só o insert é usado (feito com service_role). */
export interface LushaCreditLogClient {
  from: (table: string) => {
    insert: (
      row: LushaCreditUsageRow,
    ) => PromiseLike<{ error: { message?: string } | null }>;
  };
}

/**
 * Grava a linha de consumo. Devolve false (sem lançar) quando não há cliente
 * com service_role — a tabela só tem política de escrita para service_role —
 * ou quando o insert falha.
 */
export async function logLushaCreditUsage(
  client: LushaCreditLogClient | null,
  row: LushaCreditUsageRow,
  onError?: (msg: string, detail: string) => void,
): Promise<boolean> {
  if (!client) {
    onError?.("credit_log_skipped_no_service_role", row.operation);
    return false;
  }
  try {
    const { error } = await client.from("lusha_credit_usage_log").insert(row);
    if (error) {
      onError?.("credit_log_failed", error.message ?? "insert_error");
      return false;
    }
    return true;
  } catch (err) {
    onError?.("credit_log_threw", (err as Error).message);
    return false;
  }
}