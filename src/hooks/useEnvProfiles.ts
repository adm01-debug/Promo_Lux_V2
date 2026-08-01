import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Perfis de ambiente (staging/production/local/custom) com redirect URI
 * padrão por perfil. Persistido em localStorage — escopo por usuário/máquina,
 * sem necessidade de backend.
 */

export interface EnvProfile {
  id: string;
  name: string;
  redirect_uri: string;
  /** Tag livre: "production", "staging", "local", "custom". */
  kind: "production" | "staging" | "local" | "custom";
  /** Notas opcionais (ex.: "cluster EU", "branch preview"). */
  notes?: string;
  created_at: string;
}

const STORAGE_KEY = "lux:oauth:env-profiles";
const ACTIVE_KEY = "lux:oauth:env-profiles:active";

function defaultProfiles(): EnvProfile[] {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.example.com";
  const now = new Date().toISOString();
  return [
    {
      id: "default-prod",
      name: "Production",
      redirect_uri: `${origin}/integrations`,
      kind: "production",
      notes: "Domínio público em produção.",
      created_at: now,
    },
    {
      id: "default-staging",
      name: "Staging",
      redirect_uri: `${origin.replace(/\/+$/, "")}/integrations`,
      kind: "staging",
      notes: "Pré-produção / preview do Lovable.",
      created_at: now,
    },
    {
      id: "default-local",
      name: "Local dev",
      redirect_uri: "http://localhost:5173/integrations",
      kind: "local",
      notes: "Vite dev server local.",
      created_at: now,
    },
  ];
}

function read(): EnvProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = defaultProfiles();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EnvProfile[]) : defaultProfiles();
  } catch {
    return defaultProfiles();
  }
}

function write(list: EnvProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("lux:env-profiles:update"));
  } catch {
    /* noop */
  }
}

export function useEnvProfiles() {
  const [profiles, setProfiles] = useState<EnvProfile[]>(() => read());
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
  });

  useEffect(() => {
    const refresh = () => setProfiles(read());
    window.addEventListener("lux:env-profiles:update", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("lux:env-profiles:update", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? null,
    [profiles, activeId],
  );

  const upsert = useCallback((profile: Omit<EnvProfile, "id" | "created_at"> & { id?: string }) => {
    const list = read();
    if (profile.id) {
      const idx = list.findIndex((p) => p.id === profile.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...profile, id: profile.id } as EnvProfile;
        write(list);
        setProfiles(list);
        return list[idx];
      }
    }
    const created: EnvProfile = {
      id: crypto.randomUUID(),
      name: profile.name,
      redirect_uri: profile.redirect_uri,
      kind: profile.kind,
      notes: profile.notes,
      created_at: new Date().toISOString(),
    };
    const updated = [created, ...list];
    write(updated);
    setProfiles(updated);
    return created;
  }, []);

  const remove = useCallback(
    (id: string) => {
      const updated = read().filter((p) => p.id !== id);
      write(updated);
      setProfiles(updated);
      if (activeId === id) setActiveId(null);
    },
    [activeId, setActiveId],
  );

  const resetDefaults = useCallback(() => {
    const seed = defaultProfiles();
    write(seed);
    setProfiles(seed);
    setActiveId(null);
  }, [setActiveId]);

  return { profiles, activeProfile, activeId, setActiveId, upsert, remove, resetDefaults };
}