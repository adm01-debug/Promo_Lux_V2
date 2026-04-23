/**
 * Helper único para injetar `organization_id` em INSERT/UPSERT
 * com base na organização ativa, sem precisar repetir o campo
 * em cada chamada.
 *
 * Uso:
 *   import { db } from "@/integrations/supabase/withOrg";
 *
 *   await db.from("companies").insert({ name: "Acme" });
 *   // → INSERT inclui organization_id automaticamente
 *
 *   await db.from("deals").upsert({ id, title: "..." });
 *
 * Também funciona em listas:
 *   await db.from("stakeholders").insert([{ full_name: "A" }, { full_name: "B" }]);
 *
 * Para escapar (operações administrativas raras), use o cliente bruto:
 *   import { supabase } from "@/integrations/supabase/client";
 *
 * Nota: o banco já tem `DEFAULT default_org_for_current_user()` em
 * `organization_id`, mas isso só usa a *primeira* org do usuário.
 * Quando o usuário troca de org ativa na UI, queremos que os novos
 * registros caiam na org ativa — esse helper garante isso.
 */
import { supabase } from "./client";
import type { Database } from "./types";

type SchemaTables = Database["public"]["Tables"];
type TableName = keyof SchemaTables;

const STORAGE_KEY = "lux:active-org";
let activeOrgIdMem: string | null = null;

/** Define a organização ativa em memória (chamado pelo hook useActiveOrganization). */
export function setActiveOrgId(id: string | null) {
  activeOrgIdMem = id;
}

/** Lê a organização ativa: memória → localStorage → null. */
export function getActiveOrgId(): string | null {
  if (activeOrgIdMem) return activeOrgIdMem;
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem(STORAGE_KEY);
    if (ls) {
      activeOrgIdMem = ls;
      return ls;
    }
  }
  return null;
}

function withOrg<T extends Record<string, unknown>>(row: T, orgId: string): T {
  // Não sobrescreve se o caller já definiu explicitamente
  if (row.organization_id) return row;
  return { ...row, organization_id: orgId };
}

function injectOrg<T>(values: T, orgId: string): T {
  if (Array.isArray(values)) {
    return values.map((v) =>
      v && typeof v === "object" ? withOrg(v as Record<string, unknown>, orgId) : v,
    ) as unknown as T;
  }
  if (values && typeof values === "object") {
    return withOrg(values as Record<string, unknown>, orgId) as unknown as T;
  }
  return values;
}

/**
 * Wrapper sobre supabase.from(table) que intercepta `.insert()` e `.upsert()`
 * para injetar organization_id automaticamente. Demais métodos passam direto.
 */
export function fromOrg<T extends TableName>(table: T) {
  const builder = supabase.from(table);
  // Proxy só nos métodos que mutam dados de criação
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "insert" || prop === "upsert") {
        return (values: unknown, options?: unknown) => {
          const orgId = getActiveOrgId();
          const next = orgId ? injectOrg(values, orgId) : values;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (target as any)[prop](next, options);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** API conveniente: `db.from("companies").insert({...})`. */
export const db = {
  from: fromOrg,
};