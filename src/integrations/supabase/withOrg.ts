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

/** Erro lançado quando uma mutação cruza fronteiras de organização. */
export class OrgMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly received: string,
    public readonly table: string,
    public readonly op: string,
  ) {
    super(
      `Operação bloqueada: ${op} em "${table}" referencia organização ${received}, mas a ativa é ${expected}.`,
    );
    this.name = "OrgMismatchError";
  }
}

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

/** Valida que organization_id do payload bate com a org ativa (quando ambos existem). */
function assertOrgMatch(
  values: unknown,
  activeOrg: string,
  table: string,
  op: string,
) {
  const check = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const orgId = (v as Record<string, unknown>).organization_id;
    if (typeof orgId === "string" && orgId !== activeOrg) {
      throw new OrgMismatchError(activeOrg, orgId, table, op);
    }
  };
  if (Array.isArray(values)) values.forEach(check);
  else check(values);
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
 * para injetar organization_id automaticamente, e `.update()` / `.delete()`
 * para validar (em runtime) que o caller não está mutando registros de outra
 * organização. A validação é best-effort: confia no `organization_id` do
 * payload (update) ou em `.eq("organization_id", x)` (filtro). Como camada
 * extra, RLS no servidor é a defesa final.
 */
export function fromOrg<T extends TableName>(table: T) {
  const builder = supabase.from(table);
  const tableName = String(table);
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const orgId = getActiveOrgId();

      if (prop === "insert" || prop === "upsert") {
        return (values: unknown, options?: unknown) => {
          if (!orgId) {
            throw new OrgMismatchError("<nenhuma>", "?", tableName, String(prop));
          }
          assertOrgMatch(values, orgId, tableName, String(prop));
          const next = injectOrg(values, orgId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (target as any)[prop](next, options);
        };
      }

      if (prop === "update") {
        return (values: unknown, options?: unknown) => {
          if (orgId) {
            assertOrgMatch(values, orgId, tableName, "update");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const q = (target as any).update(values, options);
            // Restringe explicitamente o update à org ativa para nunca cruzar fronteiras
            return q.eq("organization_id", orgId);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (target as any).update(values, options);
        };
      }

      if (prop === "delete") {
        return (options?: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = (target as any).delete(options);
          return orgId ? q.eq("organization_id", orgId) : q;
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

/**
 * Valida manualmente um registro carregado contra a org ativa. Use antes de
 * abrir um modal de edição ou disparar uma ação destrutiva sobre dado que veio
 * de uma sessão/cache potencialmente desatualizado.
 *
 *   ensureSameOrg(company);            // lança OrgMismatchError se divergir
 *   ensureSameOrg(company, { silent }); // retorna boolean
 */
export function ensureSameOrg(
  record: { organization_id?: string | null } | null | undefined,
  opts: { silent?: boolean } = {},
): boolean {
  const active = getActiveOrgId();
  if (!record || !record.organization_id || !active) return true;
  if (record.organization_id === active) return true;
  if (opts.silent) return false;
  throw new OrgMismatchError(active, record.organization_id, "<record>", "guard");
}