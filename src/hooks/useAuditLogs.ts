import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AuditAction = "create" | "update" | "delete";
export type AuditTable = "companies" | "campaigns" | "workflows";

export interface AuditLog {
  id: string;
  actor_id: string | null;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  table?: AuditTable | "all";
  action?: AuditAction | "all";
  recordId?: string;
  limit?: number;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  const { table = "all", action = "all", recordId, limit = 100 } = filters;
  return useQuery({
    queryKey: ["audit-logs", table, action, recordId, limit],
    queryFn: async (): Promise<AuditLog[]> => {
      // @ts-expect-error - audit_logs not yet in generated types
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (table !== "all") q = q.eq("table_name", table);
      if (action !== "all") q = q.eq("action", action);
      if (recordId) q = q.eq("record_id", recordId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });
}
