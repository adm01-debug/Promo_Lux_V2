import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number;
}

/**
 * Retorna o localStorage de forma segura.
 * Em SSR (Next.js, Remix) localStorage não existe → retorna null.
 */
const getStorage = (): Storage | null =>
  typeof localStorage !== "undefined" ? localStorage : null;

/**
 * Parseia um timestamp de lock de forma robusta e segura.
 *
 * FIX ADV-7: parseInt("1.5e13") para nos dígitos antes do ponto, retornando 1
 * (Jan 1970 → expirado → bypass). Number() parseia notação científica corretamente.
 *
 * Retorna null para qualquer valor que não seja um número positivo finito:
 *   - Strings inválidas ("abc", "NaN", "")  → Number = NaN  → null
 *   - Não-finitos ("Infinity", "-Infinity")  → não finito    → null
 *   - Zero ou negativos ("0", "-1", "  ")   → ts <= 0       → null
 *   - Timestamps legítimos ("1750000000000") → número > 0    → valor correto
 */
const parseLockTs = (raw: string): number | null => {
  const ts = Number(raw);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
};

/**
 * Hook de Rate Limit Híbrido:
 * - LocalStorage para resposta instantânea na UI (com fallback gracioso em SSR).
 * - Edge Function para segurança server-side real (anti-burlagem).
 *
 * @param configOrKey Chave de namespace (string) ou objeto de configuração
 * @param maybeConfig Configuração quando o primeiro argumento é string
 */
export function useRateLimit(configOrKey: string | RateLimitConfig, maybeConfig?: RateLimitConfig) {
  const key = typeof configOrKey === "string" ? configOrKey : "global";
  const config = typeof configOrKey === "object" ? configOrKey : (maybeConfig || { maxAttempts: 5, windowMs: 60000 });
  const lockoutMs = config.lockoutMs ?? config.windowMs;

  // FIX-3: sanitiza lockoutMs não-finito para garantir persistência entre recarregamentos.
  // Infinity/NaN → lockTime="Infinity"/"NaN" → parseLockTs retorna null → lock perdido no reload.
  // Clampa para Number.MAX_SAFE_INTEGER (~285 anos) preservando o intent de "lockout permanente".
  const effectiveLockoutMs = Number.isFinite(lockoutMs) && lockoutMs >= 0
    ? lockoutMs
    : Number.MAX_SAFE_INTEGER;

  // GAP-5: validação de parâmetros em modo de desenvolvimento.
  // Detecta configurações silenciosamente inválidas que levam a comportamentos inesperados.
  if (import.meta.env.DEV) {
    if (!(config.maxAttempts > 0)) {
      console.warn(`[useRateLimit:${key}] maxAttempts deve ser > 0 (recebido: ${config.maxAttempts})`);
    }
    if (!(config.windowMs > 0)) {
      console.warn(`[useRateLimit:${key}] windowMs deve ser > 0 (recebido: ${config.windowMs})`);
    }
    // FIX-2: windowMs > 0 é true para Infinity, mas Infinity causa acumulação ilimitada.
    if (!Number.isFinite(config.windowMs)) {
      console.warn(
        `[useRateLimit:${key}] windowMs (${config.windowMs}) não é um número finito. ` +
        "Timestamps de tentativas acumularão indefinidamente no localStorage, sem limite de expiração. " +
        "Use um valor inteiro positivo em milissegundos (ex: 60000 para 1 minuto)."
      );
    }
    // FIX-2: lockoutMs não-finito é detectado aqui. FIX-3 garante que o valor seja sanitizado.
    if (!Number.isFinite(lockoutMs)) {
      console.warn(
        `[useRateLimit:${key}] lockoutMs (${lockoutMs}) não é um número finito. ` +
        `Será substituído por Number.MAX_SAFE_INTEGER (≈285 anos) para garantir persistência. ` +
        "Use Number.MAX_SAFE_INTEGER explicitamente para deixar a intenção clara."
      );
    }
    // Check original: apenas quando ambos são finitos (evita falso positivo com Infinity)
    if (Number.isFinite(lockoutMs) && Number.isFinite(config.windowMs) && lockoutMs < config.windowMs) {
      console.warn(
        `[useRateLimit:${key}] lockoutMs (${lockoutMs}ms) < windowMs (${config.windowMs}ms). ` +
        "Após o lockout expirar, as tentativas anteriores ainda estarão dentro da janela → " +
        "o usuário será re-bloqueado imediatamente na próxima tentativa. " +
        "Configure lockoutMs ≥ windowMs para evitar este efeito."
      );
    }
  }

  const [locked, setLocked] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);

  /**
   * Verifica o rate limit no servidor via Edge Function.
   * Chamada em momentos críticos (login, signup, password reset).
   */
  const checkServerRateLimit = useCallback(async (identifier: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("auth-rate-limit", {
        body: { identifier },
      });

      if (error) throw error;

      if (data.locked) {
        setLocked(true);
        setRemainingSec(data.remainingSec || 900); // Default 15 min
        return true;
      }
      return false;
    } catch (err) {
      console.error("[useRateLimit] Server check failed:", err);
      return false; // Fail open no client para não bloquear legítimos se a function cair
    }
  }, []);

  const checkAndRecord = useCallback(() => {
    const storage = getStorage();
    if (!storage) return { locked: false, remainingSec: 0 };

    const attemptsKey = `lux:attempts:${key}`;
    const lockKey = `lux:lock:${key}`;
    const now = Date.now();

    const lockUntil = storage.getItem(lockKey);
    if (lockUntil) {
      // FIX ADV-7: parseLockTs usa Number() + validação > 0 em vez de parseInt().
      const lockTs = parseLockTs(lockUntil);
      if (lockTs === null) {
        storage.removeItem(lockKey);
      } else {
        const remaining = Math.ceil((lockTs - now) / 1000);
        if (remaining > 0) {
          return { locked: true, remainingSec: remaining };
        }
        storage.removeItem(lockKey);
      }
    }

    // try/catch em torno do JSON.parse — corrupção de storage não trava o app.
    let attempts: number[] = [];
    try {
      const raw = storage.getItem(attemptsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          attempts = parsed.filter((t): t is number => typeof t === "number" && isFinite(t));
        }
      }
    } catch {
      storage.removeItem(attemptsKey);
    }

    // FIX GAP-NEW-A: t <= now rejeita timestamps futuros injetados via XSS.
    attempts = attempts.filter(t => t <= now && now - t < config.windowMs);

    // FIX-4: limita o array a maxAttempts entries para defender performance e storage.
    // Em uso legítimo o array nunca excede maxAttempts (o lock dispara antes do push).
    // Qualquer array maior que isso é evidência de injeção de timestamps passados.
    //
    // Benchmark: 1000 entries = 123x mais lento que 5 entries no JSON.stringify.
    // Cap mantém as entradas mais recentes (mais relevantes para o rate limit).
    //
    // LIMITAÇÃO CONHECIDA: injeção de exatamente (maxAttempts-1) timestamps passados
    // dentro da janela ainda pode forçar lock na próxima tentativa legítima do usuário.
    // Isso requer acesso de escrita ao localStorage (exige XSS no mesmo origin).
    // Defesa real: checkServerRateLimit (Edge Function) valida independente do localStorage.
    if (attempts.length > config.maxAttempts) {
      attempts = attempts.slice(-config.maxAttempts);
    }

    attempts.push(now);

    // FIX-1: try/catch em storage.setItem — previne crash por QuotaExceededError.
    try {
      storage.setItem(attemptsKey, JSON.stringify(attempts));
    } catch {
      // Quota excedida: tentativas desta sessão não serão persistidas no storage.
    }

    if (attempts.length >= config.maxAttempts) {
      // FIX-3: usa effectiveLockoutMs (sanitizado) para garantir lockTime finito.
      // FIX-5: Math.min caps lockTime em Number.MAX_SAFE_INTEGER para precisão exata.
      //
      // Problema: now + MAX_SAFE_INTEGER excede 2^53 → float64 arredonda silenciosamente ±1ms.
      // Exemplo: BigInt(now) + BigInt(MAX) = 9008949254740991 (impar, ODD)
      //          Number: 9008949254740992 (par, rounded — diff invisível mas real)
      //
      // Math.min garante lockTime = exatamente MAX_SAFE_INTEGER quando effectiveLockoutMs = MAX:
      //   - MAX_SAFE_INTEGER = 9007199254740991 é sempre representável exatamente em float64
      //   - parseLockTs("9007199254740991") → round-trip perfeito, sem perda de precisão
      //   - Semanticamente: "lock expira em 13/09/2285" (≈285 anos) — intent de "permanente"
      //
      // Casos normais (lockoutMs << MAX) são inalterados: Math.min(now+300000, MAX) = now+300000.
      const lockTime = Math.min(now + effectiveLockoutMs, Number.MAX_SAFE_INTEGER);
      const rem = Math.ceil(effectiveLockoutMs / 1000);

      // FIX-1: try/catch em storage.setItem para o lock key.
      try {
        storage.setItem(lockKey, lockTime.toString());
      } catch {
        // Quota excedida: lock desta sessão não será persistido no storage.
      }

      setLocked(true);
      setRemainingSec(rem);
      return { locked: true, remainingSec: rem };
    }

    return { locked: false, remainingSec: 0 };
  }, [key, config.windowMs, config.maxAttempts, effectiveLockoutMs]);

  // FIX GAP-2 + ADV-7: isLocked usa parseLockTs e limpa chaves inválidas/expiradas.
  const isLocked = useCallback(() => {
    const storage = getStorage();
    if (!storage) return { locked: false, remainingSec: 0 };

    const lockKey = `lux:lock:${key}`;
    const lockUntil = storage.getItem(lockKey);
    if (!lockUntil) return { locked: false, remainingSec: 0 };

    // FIX ADV-7: parseLockTs rejeita notação científica truncada e não-finitos.
    const lockTs = parseLockTs(lockUntil);
    if (lockTs === null) {
      storage.removeItem(lockKey);
      return { locked: false, remainingSec: 0 };
    }

    const remaining = Math.ceil((lockTs - Date.now()) / 1000);
    if (remaining > 0) return { locked: true, remainingSec: remaining };

    storage.removeItem(lockKey); // GAP-2: remove chave expirada
    return { locked: false, remainingSec: 0 };
  }, [key]);

  /**
   * GAP-4: Reseta o estado de rate limit para esta chave.
   */
  const reset = useCallback(() => {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(`lux:lock:${key}`);
    storage.removeItem(`lux:attempts:${key}`);
    setLocked(false);
    setRemainingSec(0);
  }, [key]);

  useEffect(() => {
    const interval = setInterval(() => {
      const status = isLocked();
      if (status.locked) {
        setLocked(true);
        setRemainingSec(status.remainingSec);
      } else if (locked) {
        setLocked(false);
        setRemainingSec(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, locked]);

  return {
    locked,
    remainingSec,
    recordAttempt: () => checkAndRecord().locked,
    checkAndRecord,
    checkServerRateLimit,
    isLocked,
    reset,
  };
}
