import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Fonte de dados da "Trilha de Auditoria" do painel de monitoramento.
 *
 * Consolida os registros da tabela `audit_logs` (preenchida por triggers
 * `log_audit_event` em empresas, negócios, campanhas, workflows, execuções de
 * workflow, tarefas de raspagem etc.), resolvendo o nome/avatar de cada ator e
 * expondo filtros + paginação no servidor.
 *
 * A leitura é escopada por organização via `db` (withOrg) e a RLS garante que
 * apenas administradores enxerguem os registros do próprio workspace.
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
  const { table, action, search, page, pageSize } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 'planned' usa o planner (EXPLAIN) — respeita filtros WHERE sem executar scan.
  // Estimativa suficiente para paginação de auditoria (dezenas de milhares de linhas).
  let query = db
    .from("audit_logs")
    .select("*", { count: "planned" })
    .order("created_at", { ascending: false });

  if (table === "automations") {
    query = query.in("table_name", AUTOMATION_TABLES as unknown as string[]);
  } else if (table !== "all") {
    query = query.eq("table_name", table);
  }

  if (action !== "all") {
    query = query.eq("action", action);
  }

  const { data: logs, count, error } = await query.range(from, to);
  if (error) throw error;

  const rows = logs ?? [];
  const actorIds = [...new Set(rows.map((l) => l.actor_id).filter(Boolean))] as string[];

  let profiles: ProfileLite[] = [];
  if (actorIds.length > 0) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", actorIds);
    profiles = data ?? [];
  }

  let merged: AuditTrailRow[] = rows.map((log) => ({
    ...log,
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

  const total = count ?? merged.length;
  return {
    rows: merged,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lista de tabelas distintas presentes na trilha, para popular o filtro. */
export function useAuditTables() {
  return useQuery({
    queryKey: ["audit-trail", "tables"],
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
  return useQuery({
    queryKey: [
      "audit-trail",
      filters.table,
      filters.action,
      filters.search,
      filters.page,
      filters.pageSize,
    ],
    queryFn: () => fetchAuditTrail(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
