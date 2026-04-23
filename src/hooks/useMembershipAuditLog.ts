import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MembershipAuditAction = "added" | "removed" | "role_changed" | "left" | "other";
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface MembershipAuditEntry {
  id: string;
  created_at: string;
  action: MembershipAuditAction;
  actor_id: string | null;
  target_user_id: string | null;
  old_role: AppRole | null;
  new_role: AppRole | null;
  is_self_action: boolean;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  raw_action: "create" | "update" | "delete";
  actor_profile?: { full_name: string | null; avatar_url: string | null } | null;
  target_profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export interface MembershipAuditPage {
  entries: MembershipAuditEntry[];
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/**
 * Backward-compatible single-page fetch (used by callers that pass a flat limit).
 */
export function useMembershipAuditLog(orgId: string | null, limit = 25) {
  return useQuery({
    queryKey: ["membership-audit", orgId, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<MembershipAuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, actor_id, old_data, new_data")
        .eq("organization_id", orgId!)
        .eq("table_name", "organization_members")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = data ?? [];
      const entries: MembershipAuditEntry[] = rows.map(r => {
        const oldData = (r.old_data as Record<string, unknown> | null) ?? null;
        const newData = (r.new_data as Record<string, unknown> | null) ?? null;
        const targetUserId = (newData?.user_id ?? oldData?.user_id ?? null) as string | null;
        const oldRole = (oldData?.role ?? null) as AppRole | null;
        const newRole = (newData?.role ?? null) as AppRole | null;

        let action: MembershipAuditAction = "other";
        if (r.action === "create") action = "added";
        else if (r.action === "delete") {
          action = r.actor_id && targetUserId && r.actor_id === targetUserId ? "left" : "removed";
        } else if (r.action === "update" && oldRole !== newRole) action = "role_changed";

        return {
          id: r.id,
          created_at: r.created_at,
          action,
          actor_id: r.actor_id,
          target_user_id: targetUserId,
          old_role: oldRole,
          new_role: newRole,
          is_self_action: !!r.actor_id && !!targetUserId && r.actor_id === targetUserId,
          old_data: oldData,
          new_data: newData,
          raw_action: r.action as "create" | "update" | "delete",
        };
      });

      const ids = Array.from(new Set(
        entries.flatMap(e => [e.actor_id, e.target_user_id].filter((x): x is string => !!x))
      ));
      if (ids.length === 0) return entries;

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map(p => [p.id, p]));

      return entries.map(e => ({
        ...e,
        actor_profile: e.actor_id && byId.get(e.actor_id)
          ? { full_name: byId.get(e.actor_id)!.full_name, avatar_url: byId.get(e.actor_id)!.avatar_url }
          : null,
        target_profile: e.target_user_id && byId.get(e.target_user_id)
          ? { full_name: byId.get(e.target_user_id)!.full_name, avatar_url: byId.get(e.target_user_id)!.avatar_url }
          : null,
      }));
    },
    refetchOnWindowFocus: false,
  });
}

/**
 * Paginated version. Fetches one extra row beyond `pageSize` to detect `hasMore`
 * without an additional COUNT query. Uses `keepPreviousData` so navigating pages
 * doesn't blank the panel.
 */
export function useMembershipAuditLogPaged(
  orgId: string | null,
  page: number,
  pageSize = 50,
) {
  return useQuery({
    queryKey: ["membership-audit-paged", orgId, page, pageSize],
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MembershipAuditPage> => {
      const from = page * pageSize;
      const to = from + pageSize; // inclusive — fetches pageSize+1 rows for hasMore check
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, actor_id, old_data, new_data")
        .eq("organization_id", orgId!)
        .eq("table_name", "organization_members")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const rows = data ?? [];
      const hasMore = rows.length > pageSize;
      const visible = hasMore ? rows.slice(0, pageSize) : rows;

      const entries: MembershipAuditEntry[] = visible.map(r => {
        const oldData = (r.old_data as Record<string, unknown> | null) ?? null;
        const newData = (r.new_data as Record<string, unknown> | null) ?? null;
        const targetUserId = (newData?.user_id ?? oldData?.user_id ?? null) as string | null;
        const oldRole = (oldData?.role ?? null) as AppRole | null;
        const newRole = (newData?.role ?? null) as AppRole | null;

        let action: MembershipAuditAction = "other";
        if (r.action === "create") action = "added";
        else if (r.action === "delete") {
          action = r.actor_id && targetUserId && r.actor_id === targetUserId ? "left" : "removed";
        } else if (r.action === "update" && oldRole !== newRole) action = "role_changed";

        return {
          id: r.id,
          created_at: r.created_at,
          action,
          actor_id: r.actor_id,
          target_user_id: targetUserId,
          old_role: oldRole,
          new_role: newRole,
          is_self_action: !!r.actor_id && !!targetUserId && r.actor_id === targetUserId,
        };
      });

      const ids = Array.from(new Set(
        entries.flatMap(e => [e.actor_id, e.target_user_id].filter((x): x is string => !!x))
      ));
      let enriched = entries;
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ids);
        const byId = new Map((profs ?? []).map(p => [p.id, p]));
        enriched = entries.map(e => ({
          ...e,
          actor_profile: e.actor_id && byId.get(e.actor_id)
            ? { full_name: byId.get(e.actor_id)!.full_name, avatar_url: byId.get(e.actor_id)!.avatar_url }
            : null,
          target_profile: e.target_user_id && byId.get(e.target_user_id)
            ? { full_name: byId.get(e.target_user_id)!.full_name, avatar_url: byId.get(e.target_user_id)!.avatar_url }
            : null,
        }));
      }

      return { entries: enriched, hasMore, page, pageSize };
    },
    refetchOnWindowFocus: false,
  });
}