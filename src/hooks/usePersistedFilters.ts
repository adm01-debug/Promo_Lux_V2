import { useState, useCallback, useEffect, useRef } from "react";

const PREFIX = "lux-filters-";

/**
 * Persists filter state to localStorage, keyed by view name.
 * Supports Sets (serialized as arrays) and primitives.
 */
export function usePersistedFilters<T extends object>(
  viewKey: string,
  defaultState: T
): [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = PREFIX + viewKey;

  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return defaultState;
      const parsed = JSON.parse(stored);
      return deserialize(parsed, defaultState as Record<string, unknown>) as T;
    } catch {
      return defaultState;
    }
  });

  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        try {
          localStorage.setItem(storageKey, JSON.stringify(serialize(next as any)));
        } catch {}
        return next;
      });
    },
    [storageKey]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStateRaw(defaultState);
  }, [storageKey, defaultState]);

  return [state, setState, reset];
}

function serialize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Set) {
      out[k] = { __set: Array.from(v) };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function deserialize(parsed: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(parsed)) {
    if (v && typeof v === "object" && "__set" in (v as any)) {
      out[k] = new Set((v as any).__set);
    } else if (k in defaults) {
      out[k] = v;
    }
  }
  return out;
}
