/**
 * Classifica a mensagem de erro de um item da DLQ em uma categoria
 * operacional para triagem/reprocessamento em massa.
 *
 * Determinístico e client-side. Testado em src/lib/dlq/__tests__/classify.test.ts.
 */

export type DlqReasonCategory =
  | "network"       // timeout, ECONNRESET, DNS
  | "rate_limit"    // 429, quota exceeded
  | "auth"          // 401, 403, invalid token
  | "not_found"     // 404, place não existe
  | "server"        // 5xx do provedor
  | "validation"    // 4xx cliente (payload inválido)
  | "unknown";

export interface DlqReasonLabel {
  category: DlqReasonCategory;
  label: string;
  retryable: boolean;
}

const RULES: Array<{ re: RegExp; category: DlqReasonCategory }> = [
  { re: /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|network|fetch failed/i, category: "network" },
  { re: /429|rate.?limit|quota|too many/i, category: "rate_limit" },
  { re: /401|403|unauthor|forbidden|invalid.?token|expired.?token/i, category: "auth" },
  { re: /404|not.?found/i, category: "not_found" },
  { re: /5\d{2}|internal server|bad gateway|service unavailable|gateway timeout/i, category: "server" },
  { re: /400|invalid.?body|invalid.?params|validation/i, category: "validation" },
];

const CATEGORY_META: Record<DlqReasonCategory, { label: string; retryable: boolean }> = {
  network: { label: "Rede", retryable: true },
  rate_limit: { label: "Rate limit", retryable: true },
  auth: { label: "Autenticação", retryable: false },
  not_found: { label: "Não encontrado", retryable: false },
  server: { label: "Erro do provedor", retryable: true },
  validation: { label: "Payload inválido", retryable: false },
  unknown: { label: "Desconhecido", retryable: true },
};

export function classifyDlqReason(lastError: string | null | undefined): DlqReasonLabel {
  const err = (lastError ?? "").trim();
  if (!err) return { category: "unknown", ...CATEGORY_META.unknown };
  for (const rule of RULES) {
    if (rule.re.test(err)) {
      return { category: rule.category, ...CATEGORY_META[rule.category] };
    }
  }
  return { category: "unknown", ...CATEGORY_META.unknown };
}

export const DLQ_CATEGORIES: DlqReasonCategory[] = [
  "network",
  "rate_limit",
  "auth",
  "not_found",
  "server",
  "validation",
  "unknown",
];

export function dlqCategoryLabel(cat: DlqReasonCategory): string {
  return CATEGORY_META[cat].label;
}

export function dlqCategoryRetryable(cat: DlqReasonCategory): boolean {
  return CATEGORY_META[cat].retryable;
}
