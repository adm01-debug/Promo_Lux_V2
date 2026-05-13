import { useEffect, useState, useCallback } from "react";
import { toast } from "./use-toast";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number;
}

export function useRateLimit(configOrKey: string | RateLimitConfig, maybeConfig?: RateLimitConfig) {
  // Overload support for both (key, config) and (config)
  const key = typeof configOrKey === "string" ? configOrKey : "global";
  const config = typeof configOrKey === "object" ? configOrKey : (maybeConfig || { maxAttempts: 5, windowMs: 60000 });
  const lockoutMs = config.lockoutMs || config.windowMs;

  const [locked, setLocked] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);

  const checkAndRecord = useCallback(() => {
    const attemptsKey = `lux:attempts:${key}`;
    const lockKey = `lux:lock:${key}`;
    const now = Date.now();

    // Check existing lock
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
      setLocked(status.locked);
      setRemainingSec(status.remainingSec);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  return { 
    locked: isLocked().locked, 
    remainingSec: isLocked().remainingSec, 
    recordAttempt: () => checkAndRecord().locked,
    checkAndRecord,
    isLocked
  };
}
