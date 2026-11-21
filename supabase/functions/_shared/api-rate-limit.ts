// Logic-a pura de decisao de rate-limit da public-api, extraida para teste
// unitario (convencao do projeto: edge functions testam so o que vive em _shared).
// A RPC check_api_key_rate_limit devolve uma linha com allowed/current_count/reset_at.

export interface RateLimitDecision {
  allowed: boolean;
  currentCount: number | null;
  resetAt: string | null;
}

// Fail-open: resposta invalida/ausente da RPC nunca bloqueia o cliente.
export function parseRateLimitDecision(rl: unknown): RateLimitDecision {
  if (!rl || typeof rl !== "object") return { allowed: true, currentCount: null, resetAt: null };
  const hasLength = (rl as { length?: number }).length !== undefined;
  const row = hasLength ? (rl as unknown[])[0] : rl;
  if (!row || typeof row !== "object") return { allowed: true, currentCount: null, resetAt: null };
  const o = row as Record<string, unknown>;
  return {
    allowed: o.allowed === undefined ? true : o.allowed === true,
    currentCount: typeof o.current_count === "number" ? (o.current_count as number) : null,
    resetAt: typeof o.reset_at === "string" ? (o.reset_at as string) : null,
  };
}

// Header HTTP Retry-After (segundos) ate o reset da janela de 1h.
export function retryAfterSeconds(resetAt: string | null): string {
  if (!resetAt) return "3600";
  const ms = new Date(resetAt).getTime() - Date.now();
  return String(Math.max(1, Math.ceil(ms / 1000)));
}
