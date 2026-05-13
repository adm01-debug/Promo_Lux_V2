/**
 * Helper único de defesa em profundidade para escopo multi-tenant.
 *
 * Para tabelas com `organization_id`, o wrapper:
 *   - INSERT/UPSERT: injeta organization_id da org ativa (se ausente)
 *                     e bloqueia se o payload trouxer outra org.
 *   - UPDATE/DELETE: força filtro `.eq("organization_id", activeOrgId)`.
 *   - SELECT:        aplica `.eq("organization_id", activeOrgId)` automático.
 *
 * Tabelas fora da lista (profiles, organizations, organization_members)
 * passam direto e ficam sob RLS específica.
 *
 * Uso:
 *   import { db } from "@/integrations/supabase/withOrg";
 *   await db.from("companies").select("*");
 *   await db.from("companies").insert({ name: "Acme" });
 */
import { supabase } from "./client";
import type { Database } from "./types";

type SchemaTables = Database["public"]["Tables"];
type TableName = keyof SchemaTables;

const STORAGE_KEY = "lux:active-org";
let activeOrgIdMem: string | null = null;

/** Define a organização ativa em memória. */
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

/**
 * Tabelas que possuem coluna `organization_id` e devem ser sempre
 * escopadas pela org ativa.
 */
const ORG_SCOPED_TABLES = new Set<string>([
  "agent_chat_messages",
  "api_keys",
  "api_request_logs",
  "audit_logs",
  "campaign_events",
  "campaign_messages",
  "campaign_recipients",
  "campaign_replies",
  "campaigns",
  "companies",
  "deal_activities",
  "deal_stages",
  "deal_tasks",
  "deals",
  "email_accounts",
  "intent_signals",
  "ipc_config",
  "notifications",
  "scrape_jobs",
  "scrape_results",
  "stakeholders",
  "webhook_deliveries",
  "webhooks",
  "workflow_runs",
  "workflows",
]);

export class OrgMismatchError extends Error {
  constructor(
    public table: string,
    public op: string,
    public expected: string | null,
    public got: unknown,
  ) {
    super(
      `[withOrg] Cross-org ${op} bloqueado em "${table}". Org ativa=${expected ?? "<none>"} payload=${String(got)}`,
    );
    this.name = "OrgMismatchError";
  }
}

/**
 * Lançado quando uma operação que escreve dados (insert/update/delete) é
 * tentada em uma tabela org-escopada SEM uma organização ativa definida.
 * Falhar fechado evita que um bug de bootstrap (org ainda carregando)
 * resulte em escrita ou deleção sem filtro.
 */
export class MissingOrgContextError extends Error {
  constructor(public table: string, public op: string) {
    super(`[withOrg] Operação "${op}" em "${table}" bloqueada: nenhuma organização ativa.`);
    this.name = "MissingOrgContextError";
  }
}

/**
 * Lança o erro disparando também o handler global (toast + ações de
 * recuperação). O handler é registrado dinamicamente para evitar
 * dependência circular (`orgErrorHandler` importa esses tipos).
 */
type OrgErrorListener = (err: Error) => void;
let orgErrorListener: OrgErrorListener | null = null;
export function setOrgErrorListener(fn: OrgErrorListener | null) {
  orgErrorListener = fn;
}
function raise(err: Error): never {
  try { orgErrorListener?.(err); } catch { /* listener nunca pode quebrar a operação */ }
  throw err;
}

function assertOrgMatch(values: unknown, orgId: string, table: string, op: string) {
  const check = (row: unknown) => {
    if (row && typeof row === "object" && "organization_id" in row) {
      const got = (row as Record<string, unknown>).organization_id;
      if (got && got !== orgId) {
        raise(new OrgMismatchError(table, op, orgId, got));
      }
    }
  };
  if (Array.isArray(values)) values.forEach(check);
  else check(values);
}

/** Verifica se um registro pertence à org ativa (helper de UI). */
export function ensureSameOrg(
  record: { organization_id?: string | null } | null | undefined,
): boolean {
  const orgId = getActiveOrgId();
  if (!orgId || !record?.organization_id) return false;
  return record.organization_id === orgId;
}

function withOrg<T extends Record<string, unknown>>(row: T, orgId: string): T {
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
 * Em UPDATE: remove `organization_id` do payload mesmo que igual à org
 * ativa — registros não devem mudar de org via update normal. Caso o
 * payload traga uma org diferente da ativa, `assertOrgMatch` já lançou.
 */
function stripOrgFromUpdate<T>(values: T): T {
  const strip = (row: Record<string, unknown>) => {
    if ("organization_id" in row) {
      const { organization_id: _omit, ...rest } = row;
      return rest;
    }
    return row;
  };
  if (Array.isArray(values)) {
    return values.map((v) =>
      v && typeof v === "object" ? strip(v as Record<string, unknown>) : v,
    ) as unknown as T;
  }
  if (values && typeof values === "object") {
    return strip(values as Record<string, unknown>) as unknown as T;
  }
  return values;
}

export function fromOrg<T extends TableName>(table: T) {
  const builder = supabase.from(table);
  const tableName = String(table);
  const isScoped = ORG_SCOPED_TABLES.has(tableName);

  return new Proxy(builder, {
    get(target, prop, receiver) {
      const orgId = getActiveOrgId();

      if (prop === "insert" || prop === "upsert") {
        return (values: unknown, options?: unknown) => {
          if (isScoped) {
            if (!orgId) raise(new MissingOrgContextError(tableName, String(prop)));
            assertOrgMatch(values, orgId, tableName, String(prop));
          }
          const next = orgId && isScoped ? injectOrg(values, orgId) : values;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return options === undefined
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (target as any)[prop](next)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (target as any)[prop](next, options);
        };
      }

      if (prop === "update" && isScoped) {
        return (values: unknown, options?: unknown) => {
          if (!orgId) raise(new MissingOrgContextError(tableName, "update"));
          assertOrgMatch(values, orgId, tableName, "update");
          // Remove organization_id do payload — UPDATE não deve "mover" registros entre orgs
          const sanitized = stripOrgFromUpdate(values);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = options === undefined
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (target as any).update(sanitized)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (target as any).update(sanitized, options);
            
          // Suporte a optimistic locking via .match() se 'version' estiver presente
          if (values && typeof values === "object" && "version" in (values as any)) {
            const version = (values as any).version;
            if (typeof version === "number") {
              return q.eq("organization_id", orgId).eq("version", version);
            }
          }
          
          return q.eq("organization_id", orgId);
        };
      }

      if (prop === "delete" && isScoped) {
        return (options?: unknown) => {
          if (!orgId) raise(new MissingOrgContextError(tableName, "delete"));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = options === undefined
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (target as any).delete()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (target as any).delete(options);
          return q.eq("organization_id", orgId);
        };
      }

      if (prop === "select" && isScoped) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = (target as any).select(...args);
          return orgId ? q.eq("organization_id", orgId) : q;
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

/** API conveniente: `db.from("companies").select("*")`. */
export const db = {
  from: fromOrg,
};