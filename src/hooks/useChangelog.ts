import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";

export interface ChangelogEntry {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: "feature" | "fix" | "improvement" | "security" | "breaking";
  version: string | null;
  published_at: string;
}

const SEEN_KEY = "lux-changelog-seen";

export const CATEGORY_LABEL: Record<ChangelogEntry["category"], string> = {
  feature: "Novidade",
  fix: "Correção",
  improvement: "Melhoria",
  security: "Segurança",
  breaking: "Atenção",
};

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markChangelogSeen(slugs: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(slugs));
  } catch {
    /* modo privado/quota: o badge simplesmente continua aparecendo */
  }
}

/**
 * Novidades do produto (in-app changelog).
 *
 * Lê `public.changelog_entries` (conteúdo de plataforma, leitura liberada a
 * qualquer usuário autenticado). "Visto" fica no localStorage por ser estado de
 * UI — não vale round-trip nem migration só para um badge.
 */
export function useChangelog() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["changelog_entries"],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog_entries")
        .select("id, slug, title, body, category, version, published_at")
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ChangelogEntry[];
    },
  });

  const entries = query.data ?? [];
  const [seen, setSeenState] = useState<string[]>([]);

  useEffect(() => {
    setSeenState(readSeen());
  }, [entries.length]);

  const unseen = entries.filter((e) => !seen.includes(e.slug));

  return {
    entries,
    unseen,
    unseenCount: unseen.length,
    isLoading: query.isLoading,
    markAllSeen: () => {
      const slugs = entries.map((e) => e.slug);
      markChangelogSeen(slugs);
      setSeenState(slugs);
    },
  };
}