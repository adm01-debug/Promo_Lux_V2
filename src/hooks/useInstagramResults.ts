import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

/**
 * Leitura da coleta de Instagram.
 *
 * O motor (`instagram-worker`) grava cada item coletado em
 * `public.instagram_scrape_results`, mas nenhuma tela lia essa tabela: os leads
 * coletados (nome, seguidores, e-mail, telefone, site) ficavam invisíveis.
 * Este módulo é a única fonte de dados do painel `InstagramResultsPanel`.
 *
 * O contato não vive em colunas: a tabela guarda o item inteiro na coluna
 * JSONB `normalized`, no formato `NormalizedInstagramItem` de
 * `supabase/functions/_shared/apify-fixtures.ts`. `flattenInstagramResult`
 * achata esse JSON em colunas tipadas e tolera dado ausente.
 */

export type InstagramTargetType = "profile" | "posts" | "hashtag" | "comments";

/** Item coletado, achatado para exibição e exportação. */
export interface InstagramResultRow {
  id: string;
  queue_id: string;
  target_type: string;
  target_value: string;
  item_type: string;
  fetched_at: string;
  username: string | null;
  full_name: string | null;
  followers: number | null;
  following: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  business_category: string | null;
  city: string | null;
  country: string | null;
  verified: boolean;
  is_private: boolean;
  is_business: boolean;
}

/** Tarefa da fila do motor, para o histórico. */
export interface InstagramQueueRow {
  id: string;
  target_type: string;
  target_value: string;
  status: string;
  attempt: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramResultsSummary {
  total: number;
  last24h: number;
  withEmail: number;
  withPhone: number;
  withWebsite: number;
  distinctProfiles: number;
}

/** Linha crua de `instagram_scrape_results` (o JSONB entra como `unknown`). */
export interface InstagramResultRecord {
  id: string;
  queue_id: string;
  target_type: string;
  target_value: string;
  item_type: string;
  fetched_at: string;
  normalized: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function flag(value: unknown): boolean {
  return value === true;
}

/** Achata a coluna JSONB `normalized` nas colunas exibidas na tela. */
export function flattenInstagramResult(row: InstagramResultRecord): InstagramResultRow {
  const n = asRecord(row.normalized);
  return {
    id: row.id,
    queue_id: row.queue_id,
    target_type: row.target_type,
    target_value: row.target_value,
    item_type: row.item_type,
    fetched_at: row.fetched_at,
    username: text(n.username),
    full_name: text(n.fullName),
    followers: count(n.followers),
    following: count(n.following),
    email: text(n.email),
    phone: text(n.phone),
    website: text(n.website),
    business_category: text(n.businessCategory),
    city: text(n.city),
    country: text(n.country),
    verified: flag(n.verified),
    is_private: flag(n.isPrivate),
    is_business: flag(n.isBusinessAccount),
  };
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Indicadores do topo do painel, calculados sobre o conjunto carregado. */
export function summarizeInstagramResults(
  rows: InstagramResultRow[],
  now: number = Date.now(),
): InstagramResultsSummary {
  const profiles = new Set<string>();
  let last24h = 0;
  let withEmail = 0;
  let withPhone = 0;
  let withWebsite = 0;

  for (const row of rows) {
    const fetched = Date.parse(row.fetched_at);
    if (Number.isFinite(fetched) && now - fetched <= TWENTY_FOUR_HOURS_MS) last24h += 1;
    if (row.email) withEmail += 1;
    if (row.phone) withPhone += 1;
    if (row.website) withWebsite += 1;
    const handle = row.username ?? row.target_value;
    if (handle) profiles.add(handle.toLowerCase());
  }

  return { total: rows.length, last24h, withEmail, withPhone, withWebsite, distinctProfiles: profiles.size };
}

/** Busca livre em @usuario, nome, alvo coletado e cidade. */
export function matchesInstagramSearch(row: InstagramResultRow, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [row.username, row.full_name, row.target_value, row.city, row.country]
    .filter((v): v is string => !!v)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function hasInstagramContact(row: InstagramResultRow): boolean {
  return !!(row.email || row.phone);
}

/** Cabeçalho e uma linha por item coletado; o contato vira coluna própria. */
export function buildInstagramResultsCsv(rows: InstagramResultRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    usuario: row.username ?? "",
    nome: row.full_name ?? "",
    seguidores: row.followers ?? "",
    email: row.email ?? "",
    telefone: row.phone ?? "",
    site: row.website ?? "",
    cidade: row.city ?? "",
    pais: row.country ?? "",
    categoria: row.business_category ?? "",
    privado: row.is_private ? "sim" : "nao",
    tipo: row.item_type,
    alvo: row.target_value,
    coletado_em: row.fetched_at,
  }));
}

/** Teto de linhas carregadas; a coluna tem índice por (organization_id, fetched_at DESC). */
export const INSTAGRAM_RESULTS_LIMIT = 500;

export function useInstagramResults(limit: number = INSTAGRAM_RESULTS_LIMIT) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["instagram-results", activeOrgId, limit],
    enabled: !!activeOrgId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_scrape_results")
        .select("id, queue_id, target_type, target_value, item_type, fetched_at, normalized")
        .eq("organization_id", activeOrgId!)
        .order("fetched_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = ((data ?? []) as InstagramResultRecord[]).map(flattenInstagramResult);
      return { rows, summary: summarizeInstagramResults(rows) };
    },
  });
}

export function useInstagramQueue(limit: number = 50) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["instagram-queue", activeOrgId, limit],
    enabled: !!activeOrgId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<InstagramQueueRow[]> => {
      const { data, error } = await supabase
        .from("instagram_scrape_queue")
        .select("id, target_type, target_value, status, attempt, max_attempts, last_error, created_at, updated_at")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as InstagramQueueRow[];
    },
  });
}
