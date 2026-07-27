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
 * FIX GAP-7: guard SSR
 */
const getStorage = (): Storage | null =>
  typeof localStorage !== "undefined" ? localStorage : null;

/**
 * Hook de Rate Limit Híbrido:
 * - LocalStorage para resposta instantânea na UI (com fallback gracioso em SSR).
 * - Edge Function para segurança server-side real (anti-burlagem).
 */
export function useRateLimit(configOrKey: string | RateLimitConfig, maybeConfig?: RateLimitConfig) {
  const key = typeof configOrKey === "string" ? configOrKey : "global";
  const config = typeof configOrKey === "object" ? configOrKey : (maybeConfig || { maxAttempts: 5, windowMs: 60000 });
  const lockoutMs = config.lockoutMs || config.windowMs;

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
    // FIX GAP-7: guard SSR — retorna unlocked silenciosamente fora do browser
    const storage = getStorage();
    if (!storage) return { locked: false, remainingSec: 0 };

    const attemptsKey = `lux:attempts:${key}`;
    const lockKey = `lux:lock:${key}`;
    const now = Date.now();

    const lockUntil = storage.getItem(lockKey);
    if (lockUntil) {
      const remaining = Math.ceil((parseInt(lockUntil) - now) / 1000);
      if (remaining > 0) {
        return { locked: true, remainingSec: remaining };
      }
      storage.removeItem(lockKey);
    }

    // FIX GAP-1: try/catch em torno do JSON.parse.
    // localStorage corrompido (ex: extensão de browser ou teste manual) não deve
    // propagar uma exceção não tratada e travar o fluxo de autenticação.
    // Estratégia: ao detectar dado inválido, descarta silenciosamente e recomeça.
    let attempts: number[] = [];
    try {
      const raw = storage.getItem(attemptsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Valida que é um array de números finitos (rejeita strings, objetos, etc.)
        if (Array.isArray(parsed)) {
          attempts = parsed.filter((t): t is number => typeof t === "number" && isFinite(t));
        }
      }
    } catch {
      // JSON malformado: limpa a chave corrompida e começa do zero.
      // Não loga pois pode conter dados sensíveis; apenas descarta.
      storage.removeItem(attemptsKey);
    }

    attempts = attempts.filter(t => now - t < config.windowMs);
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

  const isLocked = useCallback(() => {
    const storage = getStorage();
    if (!storage) return { locked: false, remainingSec: 0 };
    const lockUntil = storage.getItem(`lux:lock:${key}`);
    if (!lockUntil) return { locked: false, remainingSec: 0 };
    const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
    return remaining > 0 ? { locked: true, remainingSec: remaining } : { locked: false, remainingSec: 0 };
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
    isLocked
  };
}
