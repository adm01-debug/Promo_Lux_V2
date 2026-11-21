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
//      faz INSERT puro em vez de perder os dados.
// Assim a extracao funciona nos dois estados de schema, com ou sem a migration
// 20261122120000 aplicada.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** PostgREST responde 42P10 quando o onConflict nao casa com indice unico total. */
function isMissingConstraint(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P10") return true;
  return /no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message ?? "");
}

export interface UpsertCompaniesResult<T> {
  data: T[];
  error: { code?: string; message: string } | null;
  /** Chave de conflito efetivamente usada; `null` quando caiu em insert puro. */
  strategy: "place_id" | "name_source" | "insert";
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

  // Nenhuma constraint unica utilizavel: insert puro preserva o dado.
  const { data, error } = await supabase.from("companies").insert(rows).select();
  if (error) {
    return { data: [], error: { code: error.code, message: error.message }, strategy: "insert" };
  }
  return { data: (data ?? []) as T[], error: lastError, strategy: "insert" };
}
