import { useEffect, useState } from "react";
import { toast } from "./use-toast";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

/**
 * Hook para rate limiting client-side básico (UX).
 * Complementa o rate limiting server-side.
 */
export function useRateLimit(key: string, config: RateLimitConfig = { maxAttempts: 5, windowMs: 60000 }) {
  const [locked, setLocked] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    const checkLock = () => {
      const lockUntil = localStorage.getItem(`lux:lock:${key}`);
      if (lockUntil) {
        const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
        if (remaining > 0) {
          setLocked(true);
          setRemainingSec(remaining);
        } else {
          setLocked(false);
          setRemainingSec(0);
          localStorage.removeItem(`lux:lock:${key}`);
        }
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [key]);

  const recordAttempt = () => {
    const attemptsKey = `lux:attempts:${key}`;
    const now = Date.now();
    const attemptsRaw = localStorage.getItem(attemptsKey);
    let attempts: number[] = attemptsRaw ? JSON.parse(attemptsRaw) : [];
    
    // Filter attempts within window
    attempts = attempts.filter(t => now - t < config.windowMs);
    attempts.push(now);
    localStorage.setItem(attemptsKey, JSON.stringify(attempts));

    if (attempts.length >= config.maxAttempts) {
      const lockTime = now + config.windowMs;
      localStorage.setItem(`lux:lock:${key}`, lockTime.toString());
      setLocked(true);
      setRemainingSec(Math.ceil(config.windowMs / 1000));
      toast({
        title: "Muitas tentativas",
        description: `Por favor, aguarde ${Math.ceil(config.windowMs / 1000)} segundos.`,
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  return { locked, remainingSec, recordAttempt };
}
