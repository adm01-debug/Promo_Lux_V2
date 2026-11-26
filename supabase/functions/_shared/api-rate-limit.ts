// Logic-a pura de decisao de rate-limit da public-api, extraida para teste
// unitario (convencao do projeto: edge functions testam so o que vive em _shared).
// A RPC check_api_key_rate_limit devolve uma linha com allowed/current_count/reset_at.

export interface RateLimitDecision {
  allowed: boolean;
  currentCount: number | null;
  resetAt: string | null;
  // false quando a RPC nao devolveu uma decisao real (resposta nula, vazia ou
  // sem "allowed" booleano). Nesse caso quem chama decide com base na
  // tolerancia abaixo, em vez de liberar por padrao.
  available: boolean;
}

// Etapa 038: fail-closed. Antes qualquer resposta invalida da RPC liberava o
// cliente e o teto de 600 req/h desaparecia sem aviso.
export function parseRateLimitDecision(rl: unknown): RateLimitDecision {
  const unavailable: RateLimitDecision = {
    allowed: false,
    currentCount: null,
    resetAt: null,
    available: false,
  };
  if (!rl || typeof rl !== "object") return unavailable;
  const hasLength = (rl as { length?: number }).length !== undefined;
  const row = hasLength ? (rl as unknown[])[0] : rl;
  if (!row || typeof row !== "object") return unavailable;
  const o = row as Record<string, unknown>;
  if (typeof o.allowed !== "boolean") return unavailable;
  return {
    allowed: o.allowed,
    currentCount: typeof o.current_count === "number" ? (o.current_count as number) : null,
    resetAt: typeof o.reset_at === "string" ? (o.reset_at as string) : null,
    available: true,
  };
}

// Header HTTP Retry-After (segundos) ate o reset da janela de 1h.
export function retryAfterSeconds(resetAt: string | null): string {
  if (!resetAt) return "3600";
  const ms = new Date(resetAt).getTime() - Date.now();
  return String(Math.max(1, Math.ceil(ms / 1000)));
}

// Tolerancia curta para nao derrubar clientes por um soluco momentaneo: se a
// ultima contagem bem-sucedida desta instancia foi ha menos de 60 s, a falha
// atual libera o request; passado isso, a API responde 503 em vez de servir
// sem teto. Vive na memoria da instancia (a edge function e stateless entre
// instancias), que e o suficiente para cobrir um blip de banco.
export const FAIL_OPEN_TOLERANCE_MS = 60_000;
let lastSuccessAt = 0;

export function noteRateLimitSuccess(now: number = Date.now()): void {
  lastSuccessAt = now;
}

export function withinFailOpenTolerance(
  now: number = Date.now(),
  toleranceMs: number = FAIL_OPEN_TOLERANCE_MS,
): boolean {
  return lastSuccessAt > 0 && now - lastSuccessAt < toleranceMs;
}

export function resetRateLimitTolerance(): void {
  lastSuccessAt = 0;
}
