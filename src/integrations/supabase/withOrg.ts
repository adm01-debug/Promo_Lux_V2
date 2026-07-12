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

/**
 * Superfície mínima de dispatch dinâmico do query builder do Supabase.
 *
 * O Proxy precisa invocar métodos sobrecarregados (`insert`/`upsert`/`update`/
 * `delete`/`select`) cujas assinaturas variam por tabela e não podem ser
 * reproduzidas através de um Proxy sem perder a inferência. Em vez de espalhar
 * `any`, modelamos apenas o contrato realmente usado pelo wrapper e a cadeia de
 * filtros encadeáveis retornada.
 */
interface OrgChain {
  eq: (column: string, value: unknown) => OrgChain;
  is: (column: string, value: unknown) => OrgChain;
  not: (column: string, operator: string, value: unknown) => OrgChain;
}
interface OrgDispatchBuilder {
  insert: (values: unknown, options?: unknown) => OrgChain;
  upsert: (values: unknown, options?: unknown) => OrgChain;
  update: (values: unknown, options?: unknown) => OrgChain;
  delete: (options?: unknown) => OrgChain;
  select: (...args: unknown[]) => OrgChain;
}

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
export const ORG_SCOPED_TABLES = new Set<string>([
  "agent_chat_messages",
  "api_keys",
  "api_request_logs",
  "audit_logs",
  "automation_alerts",
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
  "email_suppressions",
  "intent_signals",
  "ipc_config",
  "notifications",
  "oauth_sandbox_snapshots",
  "scrape_jobs",
  "scrape_results",
  "stakeholders",
  "webhook_deliveries",
  "webhooks",
  "workflow_runs",
  "workflows",
]);

/**
 * Tabelas com política de soft delete (ADR-008). Nelas:
 *   - DELETE vira UPDATE `deleted_at = now()`.
 *   - SELECT filtra automaticamente `deleted_at IS NULL`.
 * A lixeira e restauração usam helpers dedicados (`db.trash`, `db.restore`,
 * `db.hardDelete`).
 */
const SOFT_DELETE_TABLES = new Set<string>([
  "companies",
  "deals",
  "campaigns",
  "workflows",
]);

/** Tabelas globais ou que gerenciam o próprio escopo via RLS específica. */
export const EXEMPT_TABLES = new Set<string>([
  "profiles",
  "organizations",
  "organization_members",
  "organization_invites",
]);

/**
 * Tabelas que POSSUEM `organization_id` mas são acessadas intencionalmente
 * fora do wrapper `db` (via `supabase.from()` cru, RPC `SECURITY DEFINER`
 * ou apenas por edge functions / admin). Ficam sob RLS específica e NÃO
 * passam pela injeção automática de org.
 *
 * Cada entrada aqui é uma decisão consciente. O teste de sincronia
 * (`withOrg.registry.test.ts`) garante que TODA tabela com `organization_id`
 * esteja classificada em exatamente um destes conjuntos — impedindo gaps
 * silenciosos quando novas tabelas multi-tenant são criadas.
 */
export const ORG_UNSCOPED_TABLES = new Set<string>([
  "api_latency_alert_history",  // leitura via supabase.from + RLS (useApiLatencyAlertSettings)
  "api_latency_alert_settings", // leitura/escrita via supabase.from + RLS (useApiLatencyAlertSettings)
  "api_latency_snapshots",      // acesso via RPC api_latency_trend/stats (SECURITY DEFINER)
  "automation_execution_logs", // leitura via supabase.from + RLS (useAutomationLogs)
  "automation_steps",          // leitura via supabase.from + RLS (JobDetailsSheet)
  "dlq_alert_history",         // leitura via supabase.from + RLS (useDlqAlertSettings)
  "dlq_alert_settings",        // leitura via supabase.from + RLS (useDlqAlertSettings)
  "dlq_health_snapshots",      // acesso via RPC dlq_health_trend (SECURITY DEFINER)
  "email_sync_log",            // leitura via supabase.from + RLS (useEmailSyncLog)
  "feature_flags",             // leitura via supabase.from + RLS (useFeatureFlags)
  "job_exports",               // gerado/consumido por edge functions
  "org_violation_alert_settings", // painel de segurança via supabase.from + RLS
  "org_violation_alerts",      // painel de segurança via supabase.from + RLS
  "scrape_dead_letter",        // DLQ: leitura via supabase.from + RPC de replay
  "scrape_queue",              // fila: escrita via RPC, leitura via supabase.from + RLS
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
  const isExempt = EXEMPT_TABLES.has(tableName);

  // Deny-by-Default: Se a tabela não for escopada nem isenta, bloqueia o acesso.
  if (!isScoped && !isExempt) {
    throw new Error(`[withOrg] Acesso bloqueado: tabela "${tableName}" não possui classificação de escopo definida.`);
  }

  return new Proxy(builder, {
    get(target, prop, receiver) {
      const orgId = getActiveOrgId();

      if (prop === "insert" || prop === "upsert") {
        return (values: any, options?: any) => {
          if (isScoped) {
            if (!orgId) raise(new MissingOrgContextError(tableName, String(prop)));
            assertOrgMatch(values, orgId, tableName, String(prop));
          }
          const next = orgId && isScoped ? injectOrg(values, orgId) : values;
          return options === undefined ? (target as any)[prop](next) : (target as any)[prop](next, options);
        };
      }

      if (prop === "update" && isScoped) {
        return (values: any, options?: any) => {
          if (!orgId) raise(new MissingOrgContextError(tableName, "update"));
          assertOrgMatch(values, orgId, tableName, "update");
          const sanitized = stripOrgFromUpdate(values);
          const q = options === undefined ? (target as any).update(sanitized) : (target as any).update(sanitized, options);
          
          if (values && typeof values === "object" && "version" in values) {
            const version = values.version;
            if (typeof version === "number") {
              return q.eq("organization_id", orgId).eq("version", version);
            }
          }
          
          return q.eq("organization_id", orgId);
        };
      }

      if (prop === "delete" && isScoped) {
        return (options?: any) => {
          if (!orgId) raise(new MissingOrgContextError(tableName, "delete"));
          // Soft delete: converte DELETE em UPDATE deleted_at = now().
          if (SOFT_DELETE_TABLES.has(tableName)) {
            return (target as any)
              .update({ deleted_at: new Date().toISOString() })
              .eq("organization_id", orgId)
              .is("deleted_at", null);
          }
          return (target as any).delete(options).eq("organization_id", orgId);
        };
      }

      if (prop === "select" && isScoped) {
        return (...args: any[]) => {
          if (!orgId) {
            console.warn(`[withOrg] Tentativa de select em "${tableName}" sem org ativa. Retornando builder sem filtro automático para evitar MissingOrgContextError imediato.`);
            return (target as any).select(...args);
          }
          const q = (target as any).select(...args).eq("organization_id", orgId);
          // Soft delete: por padrão, esconde registros na lixeira.
          if (SOFT_DELETE_TABLES.has(tableName)) {
            return q.is("deleted_at", null);
          }
          return q;
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as typeof builder;
}

/** Nomes de tabelas com soft delete (para a UI de lixeira). */
export type SoftDeleteTable = "companies" | "deals" | "campaigns" | "workflows";

/**
 * Builder de SELECT para a LIXEIRA: registros com `deleted_at IS NOT NULL`,
 * sempre escopados pela org ativa. Ex.: `db.trash("companies").select("*")`.
 */
function trashFrom(table: SoftDeleteTable) {
  const orgId = getActiveOrgId();
  const builder = supabase.from(table);
  return {
    select: (...args: any[]) => {
      if (!orgId) raise(new MissingOrgContextError(table, "trash.select"));
      return (builder as any).select(...args).eq("organization_id", orgId).not("deleted_at", "is", null);
    },
  };
}

/** Restaura um registro da lixeira (deleted_at = null), escopado por org. */
async function restoreRow(table: SoftDeleteTable, id: string) {
  const orgId = getActiveOrgId();
  if (!orgId) raise(new MissingOrgContextError(table, "restore"));
  return supabase
    .from(table)
    .update({ deleted_at: null } as any)
    .eq("id", id)
    .eq("organization_id", orgId);
}

/** Exclusão permanente (hard delete) de um item já na lixeira, escopado por org. */
async function hardDeleteRow(table: SoftDeleteTable, id: string) {
  const orgId = getActiveOrgId();
  if (!orgId) raise(new MissingOrgContextError(table, "hardDelete"));
  return supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .not("deleted_at", "is", null);
}

/** API conveniente: `db.from("companies").select("*")`. */
export const db = {
  from: fromOrg,
  trash: trashFrom,
  restore: restoreRow,
  hardDelete: hardDeleteRow,
};
