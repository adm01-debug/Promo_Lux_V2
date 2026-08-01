import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lux:cnpj-auto-enrich";
const EVENT = "lux:cnpj-auto-enrich-changed";

function readInitial(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true; // default: enabled
  return raw === "1";
}

/**
 * Preferência por-dispositivo para o enriquecimento automático via CNPJá
 * ao digitar um CNPJ válido em formulários. Sincroniza entre abas via
 * `storage` event e entre componentes via `CustomEvent`.
 */
export function useCnpjAutoEnrichSetting() {
  const [enabled, setEnabled] = useState<boolean>(readInitial);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue !== "0");
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setEnabled(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onCustom);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
    setEnabled(next);
  }, []);

  return { enabled, setEnabled: update };
}
