// ============================================================================
// _shared/companies-upsert.ts
//
// `companies` tem dois indices unicos concorrentes e o PostgREST precisa saber
// exatamente qual deles usar no `ON CONFLICT`:
//
//   - `uq_companies_org_name_source` (organization_id, name, source)
//   - `companies_org_place_id_uk`   (organization_id, place_id)
//
// Quando o alvo do `onConflict` nao corresponde a um indice unico TOTAL, o
// PostgREST responde 42P10 ("there is no unique or exclusion constraint
// matching the ON CONFLICT specification") e o lote inteiro e descartado — o
// usuario ve "0 empresas importadas" sem nenhum erro. Foi exatamente isso que
// zerou `gmaps-proxy?action=sync-results` e o import do `workflow-engine`.
//
// O problema e que um indice UNIQUE PARCIAL (com `WHERE`) NUNCA casa com
// `ON CONFLICT` via PostgREST, e o schema de producao ja passou por esse estado.
// Este helper:
//   1. tenta a chave por place_id (mais forte, o Google garante unicidade);
//   2. se o banco ainda estiver no estado legado, cai para a chave
//      (organization_id, name, source);
//   3. se as duas forem recusadas por indisponibilidade de constraint (42P10),
//      faz merge manual (select por chave natural -> update ou insert) em vez de
//      perder os dados nem duplicar a cada reimport.
// Assim a extracao funciona nos dois estados de schema, com ou sem a migration
// 20261122120000 aplicada â€” e o merge manual cobre a janela em que as functions
// sao deployadas antes da migration entrar.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** PostgREST responde 42P10 quando o onConflict nao casa com indice unico total. */
function isMissingConstraint(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P10") return true;
  return /no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message ?? "");
}

/** Estrategia de gravacao efetivamente usada. */
export type UpsertStrategy = "place_id" | "name_source" | "manual";

export interface UpsertCompaniesResult<T> {
  data: T[];
  error: { code?: string; message: string } | null;
  /** Chave de conflito efetivamente usada; `manual` quando nao havia indice unico. */
  strategy: UpsertStrategy;
}

/**
 * Grava empresas em `companies` respeitando o indice unico que o banco alvo
 * realmente possui. Nunca descarta o lote por falta de constraint: no pior
 * caso insere (duplicata e melhor que perda silenciosa de dado).
 */
export async function upsertCompanies<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  rows: Record<string, unknown> | Record<string, unknown>[],
  options: { hasPlaceId?: boolean } = {},
): Promise<UpsertCompaniesResult<T>> {
  const hasPlaceId = options.hasPlaceId
    ?? (Array.isArray(rows)
      ? rows.every((r) => !!r.place_id)
      : !!rows.place_id);

  const keys = hasPlaceId
    ? ["organization_id,place_id", "organization_id,name,source"]
    : ["organization_id,name,source"];

  let lastError: { code?: string; message: string } | null = null;

  for (const key of keys) {
    const { data, error } = await supabase
      .from("companies")
      .upsert(rows, { onConflict: key })
      .select();

    if (!error) {
      return {
        data: (data ?? []) as T[],
        error: null,
        strategy: key === "organization_id,place_id" ? "place_id" : "name_source",
      };
    }

    lastError = { code: error.code, message: error.message };
    if (!isMissingConstraint(error)) {
      // Erro real (RLS, NOT NULL, tipo): nao adianta tentar outra chave.
      return { data: [], error: lastError, strategy: key === "organization_id,place_id" ? "place_id" : "name_source" };
    }
  }

  // Nenhuma constraint unica utilizavel pelo PostgREST: merge manual por chave
  // natural. Preserva o dado E mantem a operacao idempotente, ao contrario do
  // insert puro, que duplicava o lote a cada reimport.
  return mergeByNaturalKey<T>(supabase, rows, hasPlaceId, lastError);
}

/** Chave natural usada quando o banco nao expõe indice unico ao PostgREST. */
function naturalKeyOf(row: Record<string, unknown>, hasPlaceId: boolean): string | null {
  if (hasPlaceId && row.place_id) {
    return `place:${String(row.organization_id ?? "")}|${String(row.place_id)}`;
  }
  if (row.name === undefined || row.name === null) return null;
  return `name:${String(row.organization_id ?? "")}|${String(row.name)}|${String(row.source ?? "")}`;
}

async function mergeByNaturalKey<T>(
  supabase: SupabaseClient,
  rows: Record<string, unknown> | Record<string, unknown>[],
  hasPlaceId: boolean,
  cause: { code?: string; message: string } | null,
): Promise<UpsertCompaniesResult<T>> {
  const list = Array.isArray(rows) ? rows : [rows];
  const merged: T[] = [];

  for (const row of list) {
    const key = naturalKeyOf(row, hasPlaceId);
    if (!key) {
      return { data: merged, error: cause, strategy: "manual" };
    }

    let query = supabase.from("companies").select("id");
    query = hasPlaceId && row.place_id
      ? query.eq("organization_id", row.organization_id).eq("place_id", row.place_id)
      : query
        .eq("organization_id", row.organization_id)
        .eq("name", row.name)
        .eq("source", row.source ?? "");

    const { data: existing, error: findError } = await query.limit(1).maybeSingle();
    if (findError) {
      return { data: merged, error: { code: findError.code, message: findError.message }, strategy: "manual" };
    }

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("companies")
        .update(row)
        .eq("id", (existing as { id: string }).id)
        .select();
      if (updateError) {
        return { data: merged, error: { code: updateError.code, message: updateError.message }, strategy: "manual" };
      }
      merged.push(...((updated ?? []) as T[]));
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert(row)
      .select();
    if (insertError) {
      return { data: merged, error: { code: insertError.code, message: insertError.message }, strategy: "manual" };
    }
    merged.push(...((inserted ?? []) as T[]));
  }

  return { data: merged, error: null, strategy: "manual" };
}
