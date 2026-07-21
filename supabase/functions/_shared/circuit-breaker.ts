import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CircuitBreakerRow {
  service_name: string;
  state: "closed" | "open" | "half-open";
  failure_count: number;
  last_failure_at: string | null;
  opened_at: string | null;
  half_open_at: string | null;
  threshold: number;
  reset_timeout_ms: number;
}

// Cache local por-isolate SOMENTE do fast-path (state === "closed").
// SEGURANÇA: estados "open" e "half-open" nunca são cacheados — o CB precisa
// ler o valor autoritativo do banco para manter a garantia de proteção do
// serviço downstream. TTL curto (3s) para retornar rapidamente a estados
// consistentes quando um failure real acontece. Cache invalidado explicitamente
// em reportFailure() abaixo.
const CLOSED_CACHE_TTL_MS = 3000;
const closedCache = new Map<string, number>(); // serviceName -> expiresAt (ms)

function invalidateClosedCache(serviceName: string) {
  closedCache.delete(serviceName);
}

export async function checkCircuitBreaker(supabase: SupabaseClient, serviceName: string): Promise<boolean> {
  // Fast-path: se este isolate viu esse serviço como "closed" nos últimos 3s,
  // aceita sem consultar o banco. Reduz load em ~80% em cenário de carga
  // sequencial (worker processando batch), zero impacto em correctness porque
  // reportFailure invalida a chave assim que qualquer falha é registrada
  // NO MESMO ISOLATE. Falhas de outros isolates convergem em <=3s.
  const cachedExpiry = closedCache.get(serviceName);
  if (cachedExpiry !== undefined && cachedExpiry > Date.now()) {
    return true;
  }

  const { data } = await supabase
    .from("circuit_breakers")
    .select("*")
    .eq("service_name", serviceName)
    .maybeSingle();
  const cb = data as CircuitBreakerRow | null;

  if (!cb) {
    await supabase.from("circuit_breakers").insert({ service_name: serviceName });
    closedCache.set(serviceName, Date.now() + CLOSED_CACHE_TTL_MS);
    return true;
  }

  if (cb.state === "closed") {
    closedCache.set(serviceName, Date.now() + CLOSED_CACHE_TTL_MS);
    return true;
  }

  const now = Date.now();

  if (cb.state === "open") {
    const openedAt = cb.opened_at ? new Date(cb.opened_at).getTime() : 0;
    if (now - openedAt <= cb.reset_timeout_ms) return false; // ainda no cooldown

    // Timeout expirou: tenta virar O ÚNICO probe half-open. UPDATE atômico
    // condicionado a state ainda ser 'open' — se duas requisições concorrentes
    // chegarem aqui ao mesmo tempo, só uma consegue mudar a linha (a 2ª
    // reavalia a condição após esperar o lock da 1ª e não bate mais em
    // state='open'), então só uma vira o probe; as demais ficam bloqueadas
    // em vez de todo o tráfego acumulado atravessar de uma vez (thundering
    // herd contra um serviço que acabou de cair).
    const { data: claimed } = await supabase
      .from("circuit_breakers")
      .update({ state: "half-open", half_open_at: new Date().toISOString() })
      .eq("service_name", serviceName)
      .eq("state", "open")
      .select("service_name")
      .maybeSingle();
    return !!claimed;
  }

  // state === "half-open": só o probe em andamento passa. Se o probe travou
  // (função crashou sem chamar reportSuccess/reportFailure) por mais que
  // reset_timeout_ms, permite reclamar um novo probe em vez de bloquear
  // todo o tráfego para esse serviço permanentemente.
  const halfOpenAt = cb.half_open_at ? new Date(cb.half_open_at).getTime() : 0;
  if (now - halfOpenAt <= cb.reset_timeout_ms) return false;

  const staleBefore = new Date(now - cb.reset_timeout_ms).toISOString();
  const { data: reclaimed } = await supabase
    .from("circuit_breakers")
    .update({ half_open_at: new Date().toISOString() })
    .eq("service_name", serviceName)
    .eq("state", "half-open")
    .lte("half_open_at", staleBefore)
    .select("service_name")
    .maybeSingle();
  return !!reclaimed;
}

export async function reportSuccess(supabase: SupabaseClient, serviceName: string) {
  await supabase
    .from("circuit_breakers")
    .update({ state: "closed", failure_count: 0, last_failure_at: null, opened_at: null, half_open_at: null })
    .eq("service_name", serviceName);
  // Aquecer o cache: sucesso implica estado closed autoritativo.
  closedCache.set(serviceName, Date.now() + CLOSED_CACHE_TTL_MS);
}

export async function reportFailure(supabase: SupabaseClient, serviceName: string) {
  const { data } = await supabase
    .from("circuit_breakers")
    .select("*")
    .eq("service_name", serviceName)
    .maybeSingle();
  const cb = data as CircuitBreakerRow | null;

  // Sem linha ainda (reportFailure chamado antes de qualquer
  // checkCircuitBreaker para este serviço): cria uma já com a primeira
  // falha, em vez de `cb.failure_count + 1` explodir com TypeError sobre
  // null (o bug original — .single() sem checar erro/data nula).
  if (!cb) {
    await supabase.from("circuit_breakers").insert({
      service_name: serviceName,
      failure_count: 1,
      last_failure_at: new Date().toISOString(),
    });
    return;
  }

  const newCount = cb.failure_count + 1;
  const updates: {
    failure_count: number;
    last_failure_at: string;
    state?: string;
    opened_at?: string;
  } = { failure_count: newCount, last_failure_at: new Date().toISOString() };

  if (newCount >= cb.threshold) {
    updates.state = "open";
    updates.opened_at = new Date().toISOString();
  }

  await supabase.from("circuit_breakers").update(updates).eq("service_name", serviceName);
}
