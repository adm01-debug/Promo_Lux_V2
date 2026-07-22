import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// TTL de 60s para cache em memória (-> rápido sem live-refresh constante)
const CACHE_TTL_MS = 60 * 1000;

interface FlagCacheEntry {
  value: boolean;
  expiresAt: number;
}

class FeatureFlagCache {
  private static cache = new Map<string, FlagCacheEntry>();

  static get(key: string): boolean | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  static set(key: string, value: boolean): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  static invalidate(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}

// Schema da tabela feature_flags:
//   flag_key: TEXT PRIMARY KEY
//   is_enabled: BOOLEAN
//   organization_id: UUID NULLABLE (NULL = global)
//   updated_at: TIMESTAMPTZ

/**
 * useFeatureFlag -- consulta a tabela feature_flags com cache de 60s.
 *
 * Prioridade: org-específico > global > defaultValue
 * @param flagKey - chave do flag (ex: 'web_scrape_enabled')
 * @param organizationId - UUID da organização atual (opcional)
 * @param defaultValue - valor se não encontrado (padrão: false)
 */
export function useFeatureFlag(
  flagKey: string,
  organizationId?: string | null,
  defaultValue = false,
) {
  const cacheKey = `${flagKey}:${organizationId ?? "global"}`;
  const [enabled, setEnabled] = useState<boolean>(() => {
    const cached = FeatureFlagCache.get(cacheKey);
    return cached ?? defaultValue;
  });
  const [loading, setLoading] = useState(() => FeatureFlagCache.get(cacheKey) === null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFlag = useCallback(async (forceRefresh = false) => {
    // Cache hit: saií rapido
    if (!forceRefresh) {
      const cached = FeatureFlagCache.get(cacheKey);
      if (cached !== null) {
        setEnabled(cached);
        setLoading(false);
        return;
      }
    }

    // Abortar requisição anterior se ainda pendente
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      let value = defaultValue;

      if (organizationId) {
        // Tentar flag específico da org primeiro
        const { data: orgFlag } = await supabase
          .from("feature_flags")
          .select("is_enabled")
          .eq("flag_key", flagKey)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (orgFlag !== null) {
          value = (orgFlag as { is_enabled: boolean }).is_enabled;
        } else {
          // Fallback para flag global (organization_id = NULL)
          const { data: globalFlag } = await supabase
            .from("feature_flags")
            .select("is_enabled")
            .eq("flag_key", flagKey)
            .isNull("organization_id")
            .maybeSingle();

          if (globalFlag !== null) {
            value = (globalFlag as { is_enabled: boolean }).is_enabled;
          }
        }
      } else {
        // Apenas flag global
        const { data: globalFlag } = await supabase
          .from("feature_flags")
          .select("is_enabled")
          .eq("flag_key", flagKey)
          .isNull("organization_id")
          .maybeSingle();

        if (globalFlag !== null) {
          value = (globalFlag as { is_enabled: boolean }).is_enabled;
        }
      }

      FeatureFlagCache.set(cacheKey, value);
      setEnabled(value);
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") {
        // Erro silencioso: usar defaultValue em produção
        setEnabled(defaultValue);
      }
    } finally {
      setLoading(false);
    }
  }, [flagKey, organizationId, defaultValue, cacheKey]);

  useEffect(() => {
    fetchFlag();
    return () => abortRef.current?.abort();
  }, [fetchFlag]);

  return {
    enabled,
    loading,
    refresh: () => fetchFlag(true),
    invalidateCache: () => { FeatureFlagCache.invalidate(cacheKey); },
  };
}

/**
 * useFeatureFlags -- busca múltiplos flags em 1 query (eficiente).
 */
export function useFeatureFlags(keys: string[], organizationId?: string | null) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    setLoading(true);

    (async () => {
      // buscar flags globais
      const { data: globalFlags } = await supabase
        .from("feature_flags")
        .select("flag_key, is_enabled")
        .in("flag_key", keys)
        .isNull("organization_id");

      const result: Record<string, boolean> = {};
      for (const f of globalFlags ?? []) {
        const flag = f as { flag_key: string; is_enabled: boolean };
        result[flag.flag_key] = flag.is_enabled;
      }

      if (organizationId) {
        const { data: orgFlags } = await supabase
          .from("feature_flags")
          .select("flag_key, is_enabled")
          .in("flag_key", keys)
          .eq("organization_id", organizationId);
        // Org-específico tem prioridade sobre global
        for (const f of orgFlags ?? []) {
          const flag = f as { flag_key: string; is_enabled: boolean };
          result[flag.flag_key] = flag.is_enabled;
        }
      }

      if (!aborted) {
        setFlags(result);
        setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [JSON.stringify(keys), organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { flags, loading };
}
