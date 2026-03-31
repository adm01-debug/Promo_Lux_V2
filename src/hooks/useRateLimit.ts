import { useRef, useCallback } from "react";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60_000,      // 1 minute window
  lockoutMs: 300_000,    // 5 minute lockout
};

export function useRateLimit(config: Partial<RateLimitConfig> = {}) {
  const { maxAttempts, windowMs, lockoutMs } = { ...DEFAULT_CONFIG, ...config };

  const attemptsRef = useRef<number[]>([]);
  const lockedUntilRef = useRef<number>(0);

  const isLocked = useCallback(() => {
    if (Date.now() < lockedUntilRef.current) {
      const remainingSec = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      return { locked: true, remainingSec };
    }
    return { locked: false, remainingSec: 0 };
  }, []);

  const recordAttempt = useCallback(() => {
    const now = Date.now();

    // Clear old attempts outside window
    attemptsRef.current = attemptsRef.current.filter((t) => now - t < windowMs);
    attemptsRef.current.push(now);

    if (attemptsRef.current.length >= maxAttempts) {
      lockedUntilRef.current = now + lockoutMs;
      attemptsRef.current = [];
      return { locked: true, remainingSec: Math.ceil(lockoutMs / 1000) };
    }

    return { locked: false, remainingSec: 0 };
  }, [maxAttempts, windowMs, lockoutMs]);

  const checkAndRecord = useCallback(() => {
    const lockStatus = isLocked();
    if (lockStatus.locked) return lockStatus;
    return recordAttempt();
  }, [isLocked, recordAttempt]);

  return { isLocked, recordAttempt, checkAndRecord };
}
