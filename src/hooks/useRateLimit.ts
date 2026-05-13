import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number;
}

/**
 * Hook de Rate Limit Híbrido:
 * - LocalStorage para resposta instantânea na UI.
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
    const attemptsKey = `lux:attempts:${key}`;
    const lockKey = `lux:lock:${key}`;
    const now = Date.now();

    const lockUntil = localStorage.getItem(lockKey);
    if (lockUntil) {
      const remaining = Math.ceil((parseInt(lockUntil) - now) / 1000);
      if (remaining > 0) {
        return { locked: true, remainingSec: remaining };
      }
      localStorage.removeItem(lockKey);
    }

    const attemptsRaw = localStorage.getItem(attemptsKey);
    let attempts: number[] = attemptsRaw ? JSON.parse(attemptsRaw) : [];
    
    attempts = attempts.filter(t => now - t < config.windowMs);
    attempts.push(now);
    localStorage.setItem(attemptsKey, JSON.stringify(attempts));

    if (attempts.length >= config.maxAttempts) {
      const lockTime = now + lockoutMs;
      localStorage.setItem(lockKey, lockTime.toString());
      const rem = Math.ceil(lockoutMs / 1000);
      setLocked(true);
      setRemainingSec(rem);
      return { locked: true, remainingSec: rem };
    }

    return { locked: false, remainingSec: 0 };
  }, [key, config.windowMs, config.maxAttempts, lockoutMs]);

  const isLocked = useCallback(() => {
    const lockUntil = localStorage.getItem(`lux:lock:${key}`);
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
      } else if (!locked) {
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

