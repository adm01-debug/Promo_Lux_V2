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

  // GAP-5: validação de parâmetros em modo de desenvolvimento.
  if (import.meta.env.DEV) {
    if (!(config.maxAttempts > 0)) {
      console.warn(`[useRateLimit:${key}] maxAttempts deve ser > 0 (recebido: ${config.maxAttempts})`);
    }
    if (!(config.windowMs > 0)) {
      console.warn(`[useRateLimit:${key}] windowMs deve ser > 0 (recebido: ${config.windowMs})`);
    }
    if (lockoutMs < config.windowMs) {
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
      // Valores inválidos (notação científica mal-parsada, NaN, Infinity, zero,
      // strings vazias) são removidos do storage e tratados como lock expirado.
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
    // Filtro anterior (now - t < windowMs) aceitava futuros: (now - t) negativo
    // é sempre menor que windowMs positivo. Um atacante podia injetar N-1 futuros
    // para forçar o lock na próxima tentativa legítima (DoS seletivo de conta).
    // t ∈ (now - windowMs, now] é o intervalo correto para "dentro da janela".
    attempts = attempts.filter(t => t <= now && now - t < config.windowMs);
    attempts.push(now);
    storage.setItem(attemptsKey, JSON.stringify(attempts));

    if (attempts.length >= config.maxAttempts) {
      const lockTime = now + lockoutMs;
      storage.setItem(lockKey, lockTime.toString());
      const rem = Math.ceil(lockoutMs / 1000);
      setLocked(true);
      setRemainingSec(rem);
      return { locked: true, remainingSec: rem };
    }

    return { locked: false, remainingSec: 0 };
  }, [key, config.windowMs, config.maxAttempts, lockoutMs]);

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
   * Útil para fluxos administrativos (suporte desbloqueia usuário após verificação)
   * ou em testes de integração que precisam limpar estado entre cenários.
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
