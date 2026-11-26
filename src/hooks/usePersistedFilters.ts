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

  // `defaultState` costuma ser um literal criado inline a cada render (nova
  // identidade a cada desenho): mantido numa ref para o escutador de `storage`
  // ser instalado uma única vez em vez de reinstalado a cada render.
  const defaultsRef = useRef(defaultState);
  defaultsRef.current = defaultState;

  // Sincronização entre abas
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const next = deserialize(parsed, defaultsRef.current as Record<string, unknown>) as T;
          setStateRaw(next);
        } catch { /* valor persistido inválido: mantém estado atual */ }
      } else if (e.key === storageKey && !e.newValue) {
        setStateRaw(defaultsRef.current);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        try {
          localStorage.setItem(storageKey, JSON.stringify(serialize(next as Record<string, unknown>)));
        } catch { /* storage indisponível (quota/privado): ignora persistência */ }
        return next;
      });
    },
    [storageKey]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStateRaw(defaultsRef.current);
  }, [storageKey]);

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
    if (v && typeof v === "object" && "__set" in (v as Record<string, unknown>)) {
      out[k] = new Set((v as Record<string, unknown>).__set as unknown[]);
    } else if (k in defaults) {
      out[k] = v;
    }
  }
  return out;
}
