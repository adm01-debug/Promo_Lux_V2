import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Fonte de dados da "Trilha de Auditoria" do painel de monitoramento.
 *
 * Consolida os registros da tabela `audit_logs` (preenchida por triggers
 * `log_audit_event` em empresas, negócios, campanhas, workflows, execuções de
 * workflow, tarefas de raspagem etc.), resolvendo o nome/avatar de cada ator e
 * expondo filtros + paginação no servidor.
 *
 * A leitura passa por `read_audit_logs_safe` (SECURITY DEFINER, admin da
 * organização), que aplica as regras de mascaramento de PII em `old_data`,
 * `new_data` e `metadata` — mesmo motor usado no arquivo exportado. Sem regra
 * ativa os valores voltam inalterados.
 */

export type AuditActionFilter = "all" | Tables<"audit_logs">["action"];

/** Conjunto de tabelas consideradas "automações" para o filtro rápido. */
export const AUTOMATION_TABLES = [
  "scrape_jobs",
  "workflow_runs",
  "workflows",
  "automation_steps",
] as const;

export interface AuditTrailFilters {
  /** Nome da tabela/entidade. "all" = todas; "automations" = só automações. */
  table: string;
  /** Tipo de ação (create/update/delete/execute). */
  action: AuditActionFilter;
  /** Busca livre por ator (nome) — aplicada no cliente sobre a página atual. */
  search: string;
  /** Página (1-indexada). */
  page: number;
  /** Itens por página. */
  pageSize: number;
  /** Filtro por período — ISO date (YYYY-MM-DD) inclusivo, ou vazio para ignorar. */
  dateFrom?: string;
  dateTo?: string;
}

export const DEFAULT_AUDIT_FILTERS: AuditTrailFilters = {
  table: "all",
  action: "all",
  search: "",
  page: 1,
  pageSize: 25,
  dateFrom: "",
  dateTo: "",
};

type ProfileLite = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url">;

export type AuditTrailRow = Tables<"audit_logs"> & {
  actor: ProfileLite | null;
};

export interface AuditTrailResult {
  rows: AuditTrailRow[];
  total: number;
  totalPages: number;
}

export async function fetchAuditTrail(filters: AuditTrailFilters): Promise<AuditTrailResult> {
  const { table, action, search, page, pageSize, dateFrom, dateTo } = filters;
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Organização não selecionada");
  const offset = (page - 1) * pageSize;

  const tables =
    table === "automations"
      ? [...AUTOMATION_TABLES]
      : table !== "all"
        ? [table]
        : undefined;

  // Leitura pelo motor de PII: os registros sao os mesmos da tabela, mas
  // `old_data`/`new_data`/`metadata` passam pelas regras de mascaramento da org.
  const { data: safeRows, error } = await supabase.rpc("read_audit_logs_safe", {
    _org_id: orgId,
    _limit: pageSize,
    _offset: offset,
    _action: action === "all" ? undefined : action,
    _tables: tables,
    _from: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
    _to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
  });
  if (error) throw error;

  const rows = safeRows ?? [];
  const actorIds = [...new Set(rows.map((l) => l.actor_id).filter(Boolean))] as string[];

  let profiles: ProfileLite[] = [];
  if (actorIds.length > 0) {
    // Erro ignorado de proposito: so decora a linha com nome/avatar; sem isso o
    // registro continua listado com o id abreviado (fallback logo abaixo).
    const { data } = await db
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", actorIds);
    profiles = data ?? [];
  }

  let merged: AuditTrailRow[] = rows.map(({ total_count: _total, ...log }) => ({
    ...log,
    action: log.action as Tables<"audit_logs">["action"],
    actor: profiles.find((p) => p.id === log.actor_id) ?? null,
  }));

  // Busca por ator é refinada no cliente sobre a página carregada.
  const term = search.trim().toLowerCase();
  if (term) {
    merged = merged.filter(
      (r) =>
        r.actor?.full_name?.toLowerCase().includes(term) ||
        r.actor_id?.toLowerCase().includes(term) ||
        r.table_name.toLowerCase().includes(term),
    );
  }

  // Total vem do proprio leitor (page 1 sem linhas = 0; paginas seguintes existem
  // porque a anterior tinha registros).
  const total = rows[0]?.total_count ?? (page > 1 ? (page - 1) * pageSize : 0);
  return {
    rows: merged,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lista de tabelas distintas presentes na trilha, para popular o filtro. */
export function useAuditTables() {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["audit-trail", "tables", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db
        .from("audit_logs")
        .select("table_name")
        .order("table_name", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.table_name))].sort();
    },
    staleTime: 60_000,
  });
}

export function useAuditTrail(filters: AuditTrailFilters) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: [
      "audit-trail",
      filters.table,
      filters.action,
      filters.search,
      filters.page,
      filters.pageSize,
      filters.dateFrom ?? "",
      filters.dateTo ?? "",
      activeOrgId,
    ],
    queryFn: () => fetchAuditTrail(filters),
    enabled: !!activeOrgId,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
