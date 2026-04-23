import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Audit log entries for `email_accounts` (connect / update / disconnect).
 *
 * The trigger `trg_audit_email_accounts` writes to `audit_logs` on every
 * insert/update/delete, capturing `old_data` and `new_data`. We classify each
 * row into a domain action so the UI can summarise it without reading raw JSON:
 *
 *  - `connected`        : insert
 *  - `disconnected`     : delete
 *  - `scope_changed`    : update where `scope_type` differs (user ↔ organization)
 *  - `tokens_refreshed` : update where access/refresh tokens or expiry rotated
 *  - `reactivated`      : update where `active` flipped false → true
 *  - `deactivated`      : update where `active` flipped true → false
 *  - `error_recorded`   : update that introduced a new `last_error` value
 *  - `polled`           : update that only moved `last_polled_at` / sync cursors forward
 *  - `updated`          : any other field-level change (display_name, etc.)
 */
export type EmailAccountAuditAction =
  | "connected"
  | "disconnected"
  | "scope_changed"
  | "tokens_refreshed"
  | "reactivated"
  | "deactivated"
  | "error_recorded"
  | "polled"
  | "updated";

export interface EmailAccountAuditEntry {
  id: string;
  created_at: string;
  raw_action: "create" | "update" | "delete";
  action: EmailAccountAuditAction;
  actor_id: string | null;
  account_id: string;
  email: string | null;
  provider: "gmail" | "outlook" | null;
  scope_type: "user" | "organization" | null;
  previous_scope_type: "user" | "organization" | null;
  organization_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor_profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export interface EmailAccountAuditPage {
  entries: EmailAccountAuditEntry[];
  hasMore: boolean;
  page: number;
  pageSize: number;
}

const TOKEN_FIELDS = ["access_token", "refresh_token", "expires_at"] as const;
const SYNC_FIELDS = ["last_polled_at", "history_id", "delta_link"] as const;

function pickStr(obj: Record<string, unknown> | null, key: string): string | null {
  const v = obj?.[key];
  return typeof v === "string" ? v : null;
}

function classify(
  raw: "create" | "update" | "delete",
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): EmailAccountAuditAction {
  if (raw === "create") return "connected";
  if (raw === "delete") return "disconnected";
  // update
  const oldScope = pickStr(oldData, "scope_type");
  const newScope = pickStr(newData, "scope_type");
  if (oldScope && newScope && oldScope !== newScope) return "scope_changed";

  const oldActive = oldData?.active === true;
  const newActive = newData?.active === true;
  if (oldActive !== newActive) return newActive ? "reactivated" : "deactivated";

  const oldErr = pickStr(oldData, "last_error");
  const newErr = pickStr(newData, "last_error");
  if (newErr && newErr !== oldErr) return "error_recorded";

  const tokenChanged = TOKEN_FIELDS.some(
    (f) => JSON.stringify(oldData?.[f] ?? null) !== JSON.stringify(newData?.[f] ?? null),
  );
  if (tokenChanged) return "tokens_refreshed";

  const syncOnly = SYNC_FIELDS.some(
    (f) => JSON.stringify(oldData?.[f] ?? null) !== JSON.stringify(newData?.[f] ?? null),
  );
  if (syncOnly) return "polled";

  return "updated";
}

function toEntry(r: {
  id: string;
  created_at: string;
  action: string;
  actor_id: string | null;
  record_id: string;
  organization_id: string | null;
  old_data: unknown;
  new_data: unknown;
}): EmailAccountAuditEntry {
  const oldData = (r.old_data as Record<string, unknown> | null) ?? null;
  const newData = (r.new_data as Record<string, unknown> | null) ?? null;
  const raw = r.action as "create" | "update" | "delete";
  const action = classify(raw, oldData, newData);
  return {
    id: r.id,
    created_at: r.created_at,
    raw_action: raw,
    action,
    actor_id: r.actor_id,
    account_id: r.record_id,
    email: pickStr(newData, "email") ?? pickStr(oldData, "email"),
    provider: (pickStr(newData, "provider") ?? pickStr(oldData, "provider")) as
      | "gmail"
      | "outlook"
      | null,
    scope_type: (pickStr(newData, "scope_type") ?? pickStr(oldData, "scope_type")) as
      | "user"
      | "organization"
      | null,
    previous_scope_type:
      action === "scope_changed"
        ? ((pickStr(oldData, "scope_type") as "user" | "organization" | null) ?? null)
        : null,
    organization_id: r.organization_id,
    old_data: oldData,
    new_data: newData,
  };
}

/**
 * Paginated audit log for email accounts in the active organization.
 * Fetches `pageSize+1` rows to detect `hasMore` cheaply.
 */
export function useEmailAccountAuditLog(
  orgId: string | null,
  page = 0,
  pageSize = 25,
) {
  return useQuery({
    queryKey: ["email-account-audit", orgId, page, pageSize],
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<EmailAccountAuditPage> => {
      const from = page * pageSize;
      const to = from + pageSize;
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, actor_id, record_id, organization_id, old_data, new_data")
        .eq("organization_id", orgId!)
        .eq("table_name", "email_accounts")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const rows = data ?? [];
      const hasMore = rows.length > pageSize;
      const visible = hasMore ? rows.slice(0, pageSize) : rows;
      const entries = visible.map(toEntry);

      const ids = Array.from(
        new Set(entries.map((e) => e.actor_id).filter((x): x is string => !!x)),
      );
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ids);
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        return {
          entries: entries.map((e) => ({
            ...e,
            actor_profile:
              e.actor_id && byId.get(e.actor_id)
                ? {
                    full_name: byId.get(e.actor_id)!.full_name,
                    avatar_url: byId.get(e.actor_id)!.avatar_url,
                  }
                : null,
          })),
          hasMore,
          page,
          pageSize,
        };
      }

      return { entries, hasMore, page, pageSize };
    },
    refetchOnWindowFocus: false,
  });
}