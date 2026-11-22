import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "@/hooks/use-toast";

export interface AuditLogRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data: unknown;
  new_data: unknown;
  metadata: unknown;
  created_at: string;
}

export interface AuditFilters {
  from: string | null;
  to: string | null;
  action: string | null;
  tableName: string | null;
}

const PAGE = 1000;
const MAX_PAGES = 200; // teto de seguranca: 200k linhas por export

function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : "Erro desconhecido");
}

export function useAuditLogExport() {
  const { activeOrgId } = useActiveOrganization();
  const [isExporting, setIsExporting] = useState(false);

  const facetsQuery = useQuery({
    queryKey: ["audit-facets", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<{ actions: string[]; tables: string[] }> => {
      const { data, error } = await supabase.rpc("audit_log_facets", { _org_id: activeOrgId! });
      if (error) throw error;
      const raw = (data ?? {}) as { actions?: string[]; tables?: string[] };
      return { actions: raw.actions ?? [], tables: raw.tables ?? [] };
    },
  });

  const countLogs = useCallback(
    async (filters: AuditFilters): Promise<number> => {
      if (!activeOrgId) return 0;
      const { data, error } = await supabase.rpc("count_audit_logs", {
        _org_id: activeOrgId,
        _from: filters.from ?? undefined,
        _to: filters.to ?? undefined,
        _action: filters.action ?? undefined,
        _table_name: filters.tableName ?? undefined,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    [activeOrgId],
  );

  /** Busca todas as páginas por cursor e devolve as linhas. */
  const fetchAll = useCallback(
    async (filters: AuditFilters): Promise<AuditLogRow[]> => {
      if (!activeOrgId) throw new Error("Organização não selecionada");
      const all: AuditLogRow[] = [];
      let afterCreated: string | null = null;
      let afterId: string | null = null;

      for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await supabase.rpc("export_audit_logs", {
          _org_id: activeOrgId,
          _from: filters.from ?? undefined,
          _to: filters.to ?? undefined,
          _action: filters.action ?? undefined,
          _table_name: filters.tableName ?? undefined,
          _after_created_at: afterCreated ?? undefined,
          _after_id: afterId ?? undefined,
          _limit: PAGE,
        });
        if (error) throw error;
        const rows = (data ?? []) as AuditLogRow[];
        all.push(...rows);
        if (rows.length < PAGE) return all;
        const last = rows[rows.length - 1];
        afterCreated = last.created_at;
        afterId = last.id;
      }
      throw new Error(`Export truncado em ${MAX_PAGES * PAGE} linhas — refine o período.`);
    },
    [activeOrgId],
  );

  const download = useCallback(
    async (filters: AuditFilters, format: "ndjson" | "json" | "csv") => {
      setIsExporting(true);
      try {
        const rows = await fetchAll(filters);
        if (rows.length === 0) {
          toast({ title: "Nenhum registro no período selecionado" });
          return 0;
        }
        let content = "";
        let mime = "application/json";
        if (format === "ndjson") {
          content = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
          mime = "application/x-ndjson";
        } else if (format === "json") {
          content = JSON.stringify(rows, null, 2);
        } else {
          const cols = ["id", "created_at", "action", "table_name", "record_id", "user_id"];
          const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
          content =
            cols.join(",") +
            "\n" +
            rows.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(",")).join("\n") +
            "\n";
          mime = "text/csv";
        }

        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.${format === "ndjson" ? "ndjson" : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({ title: `${rows.length} registro(s) exportado(s)` });
        return rows.length;
      } catch (e) {
        toast({ title: "Falha na exportação", description: asError(e).message, variant: "destructive" });
        return -1;
      } finally {
        setIsExporting(false);
      }
    },
    [fetchAll],
  );

  return {
    actions: facetsQuery.data?.actions ?? [],
    tables: facetsQuery.data?.tables ?? [],
    facetsLoading: facetsQuery.isLoading,
    countLogs,
    download,
    isExporting,
  };
}