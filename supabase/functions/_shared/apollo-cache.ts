// ============================================================================
// _shared/apollo-cache.ts
// Cache agressivo + controle de rate limit para as chamadas ao Apollo.
//
// Motivação (dupla):
//  1. CRÉDITO — o Apollo cobra por consulta; o mesmo domínio + mesmo filtro de
//     departamento é buscado repetidamente (re-execução da mesma empresa,
//     usuários diferentes na mesma org). Cachear a RESPOSTA (inclusive a
//     resposta vazia) elimina a chamada.
//  2. 403 / API_INACCESSIBLE — chave sem acesso ao endpoint ou cota estourada.
//     Bater de novo não resolve e ainda queima cota, então após um 401/403
//     entra um cooldown global persistido no banco: nenhuma edge invocation
//     tenta o Apollo até o cooldown vencer.
//
// Toda a parte de banco é `service_role` (RPCs SECURITY DEFINER). As funções
// puras deste módulo são testadas em __tests__/apollo-cache.test.ts.
// ============================================================================

/** TTL do cache por tipo de resultado. */
export const APOLLO_CACHE_TTL_HIT_SECONDS = 7 * 24 * 60 * 60; // 7 dias
/** Resposta vazia expira mais rápido: a empresa pode ganhar contatos. */
export const APOLLO_CACHE_TTL_EMPTY_SECONDS = 24 * 60 * 60; // 24 horas

/** Cooldown aplicado quando o Apollo devolve 401/403 (chave sem acesso). */
export const APOLLO_COOLDOWN_FORBIDDEN_SECONDS = 6 * 60 * 60; // 6 horas
/** Cooldown curto para 429 — é cota de janela, não falta de permissão. */
export const APOLLO_COOLDOWN_RATE_LIMIT_SECONDS = 15 * 60; // 15 minutos

export interface ApolloCacheKeyInput {
  domain: string;
  titles?: string[];
  departments?: string[];
  size?: number;
}

function canonList(values: string[] | undefined): string {
  if (!values?.length) return "";
  // Ordena e normaliza: a ordem dos títulos vinda do mapa de departamentos não
  // pode gerar duas entradas de cache para a mesma consulta.
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join(",");
}

/**
 * Chave estável e determinística da consulta. Mesmos filtros em ordens
 * diferentes ⇒ mesma chave. `size` entra porque muda o volume retornado.
 */
export function buildApolloCacheKey(input: ApolloCacheKeyInput): string {
  const domain = input.domain.trim().toLowerCase();
  const size = Math.min(Math.max(input.size ?? 25, 1), 100);
  return [
    "v1",
    domain,
    canonList(input.departments),
    canonList(input.titles),
    String(size),
  ].join("|");
}

/** TTL correto conforme o resultado obtido. */
export function ttlForResult(contactCount: number): number {
  return contactCount > 0
    ? APOLLO_CACHE_TTL_HIT_SECONDS
    : APOLLO_CACHE_TTL_EMPTY_SECONDS;
}

/** Cooldown adequado ao status HTTP devolvido pelo Apollo (0 = sem cooldown). */
export function cooldownForStatus(status: number | undefined): number {
  if (status === 401 || status === 403) return APOLLO_COOLDOWN_FORBIDDEN_SECONDS;
  if (status === 429) return APOLLO_COOLDOWN_RATE_LIMIT_SECONDS;
  return 0;
}

export type ApolloRateReason = "ok" | "cooldown" | "minute_limit" | "daily_limit" | "unavailable";

export interface ApolloRateDecision {
  allowed: boolean;
  reason: ApolloRateReason;
  retryAfterSeconds?: number;
  minuteRemaining?: number;
  dailyRemaining?: number;
}

/** Traduz o JSON da RPC `apollo_rate_consume` para o shape tipado. */
export function parseRateDecision(raw: unknown): ApolloRateDecision {
  if (!raw || typeof raw !== "object") {
    // Falha ao ler a cota é tratada como "pode seguir": o cache e o circuit
    // breaker continuam protegendo, e não queremos derrubar o fallback por
    // indisponibilidade da tabela de contagem.
    return { allowed: true, reason: "ok" };
  }
  const r = raw as Record<string, unknown>;
  const reason = typeof r.reason === "string" ? r.reason : "ok";
  return {
    allowed: r.allowed === true,
    reason: (["ok", "cooldown", "minute_limit", "daily_limit", "unavailable"].includes(reason)
      ? reason
      : "unavailable") as ApolloRateReason,
    retryAfterSeconds: typeof r.retry_after_seconds === "number" ? r.retry_after_seconds : undefined,
    minuteRemaining: typeof r.minute_remaining === "number" ? r.minute_remaining : undefined,
    dailyRemaining: typeof r.daily_remaining === "number" ? r.daily_remaining : undefined,
  };
}

// ─────────────────────────── camada de banco ────────────────────────────────

/** Cliente mínimo (structural typing) — evita import cruzado do supabase-js. */
export interface RpcClient {
  // PromiseLike: o builder do supabase-js é thenable, não Promise.
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface ApolloCachedEntry<T = unknown> {
  status: "hit" | "empty";
  payload: T;
  contactCount: number;
  fetchedAt: string | null;
  hitCount: number;
}

/** Lê o cache. Nunca lança: erro de cache vira MISS. */
export async function readApolloCache<T = unknown>(
  client: RpcClient,
  cacheKey: string,
): Promise<ApolloCachedEntry<T> | null> {
  try {
    const { data, error } = await client.rpc("apollo_cache_get", { p_key: cacheKey });
    if (error || !data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const status = d.status === "hit" || d.status === "empty" ? d.status : null;
    if (!status) return null;
    return {
      status,
      payload: (d.payload ?? {}) as T,
      contactCount: typeof d.contact_count === "number" ? d.contact_count : 0,
      fetchedAt: typeof d.fetched_at === "string" ? d.fetched_at : null,
      hitCount: typeof d.hit_count === "number" ? d.hit_count : 0,
    };
  } catch {
    return null;
  }
}

/** Grava o cache. Nunca lança: falha de gravação não pode quebrar a busca. */
export async function writeApolloCache(
  client: RpcClient,
  args: { cacheKey: string; domain: string; payload: unknown; contactCount: number },
): Promise<void> {
  try {
    await client.rpc("apollo_cache_put", {
      p_key: args.cacheKey,
      p_domain: args.domain,
      p_status: args.contactCount > 0 ? "hit" : "empty",
      p_payload: args.payload ?? {},
      p_contact_count: args.contactCount,
      p_ttl_seconds: ttlForResult(args.contactCount),
    });
  } catch {
    /* silencioso por desenho */
  }
}

/** Consome 1 slot da cota global. Nunca lança. */
export async function consumeApolloRate(client: RpcClient): Promise<ApolloRateDecision> {
  try {
    const { data, error } = await client.rpc("apollo_rate_consume");
    if (error) return { allowed: true, reason: "ok" };
    return parseRateDecision(data);
  } catch {
    return { allowed: true, reason: "ok" };
  }
}

/** Aplica cooldown global após 401/403/429. Nunca lança. */
export async function disableApolloFor(
  client: RpcClient,
  seconds: number,
  reason: string,
): Promise<void> {
  if (seconds <= 0) return;
  try {
    await client.rpc("apollo_rate_disable", { p_seconds: seconds, p_reason: reason });
  } catch {
    /* silencioso por desenho */
  }
}
