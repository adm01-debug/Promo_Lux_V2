import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useActiveOrganization } from "@/contexts/active-org-context";

/**
 * Consumo de crédito da Lusha (public.lusha_credit_usage_log).
 *
 * A tabela é alimentada pela edge function `lusha-reveal` com o custo que a
 * própria API devolve; aqui ela é lida por membro da organização (RLS
 * "org_members_view_credit_usage") e resumida por usuário e por operação.
 * Leitura via `supabase.from` cru + `.eq("organization_id")` porque a tabela
 * está classificada em ORG_UNSCOPED_TABLES em withOrg.ts.
 */
export interface LushaCreditUsageRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  bitrix_card_id: string | null;
  company_name: string | null;
  domain: string | null;
  endpoint: string;
  operation: string;
  api_version: string | null;
  success: boolean;
  credits_charged: number;
  records_returned: number;
  request_id: string | null;
  error_code: string | null;
  created_at: string;
}

export interface LushaCreditByUser {
  userId: string | null;
  name: string | null;
  credits: number;
  calls: number;
  records: number;
  failures: number;
  lastAt: string | null;
}

export interface LushaCreditByOperation {
  operation: string;
  credits: number;
  calls: number;
}

export interface LushaCreditUsageSummary {
  credits: number;
  calls: number;
  records: number;
  failures: number;
  lastAt: string | null;
  byUser: LushaCreditByUser[];
  byOperation: LushaCreditByOperation[];
}

const USAGE_COLUMNS =
  "id, organization_id, user_id, bitrix_card_id, company_name, domain, endpoint, operation, api_version, success, credits_charged, records_returned, request_id, error_code, created_at";

/** Primeiro instante do mês corrente (UTC) — início da janela exibida. */
export function monthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function toCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function newerThan(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current || candidate > current) return candidate;
  return current;
}

export function summarizeLushaCreditUsage(
  rows: readonly LushaCreditUsageRow[],
): LushaCreditUsageSummary {
  const users = new Map<string, LushaCreditByUser>();
  const operations = new Map<string, LushaCreditByOperation>();
  let credits = 0;
  let records = 0;
  let failures = 0;
  let lastAt: string | null = null;

  for (const row of rows) {
    const charged = toCount(row.credits_charged);
    const returned = toCount(row.records_returned);
    const failed = row.success === false;

    credits += charged;
    records += returned;
    if (failed) failures += 1;
    lastAt = newerThan(lastAt, row.created_at ?? null);

    const userKey = row.user_id ?? "sem-usuario";
    const user = users.get(userKey) ?? {
      userId: row.user_id ?? null,
      name: null,
      credits: 0,
      calls: 0,
      records: 0,
      failures: 0,
      lastAt: null,
    };
    user.credits += charged;
    user.calls += 1;
    user.records += returned;
    if (failed) user.failures += 1;
    user.lastAt = newerThan(user.lastAt, row.created_at ?? null);
    users.set(userKey, user);

    const operationKey = row.operation || "—";
    const operation = operations.get(operationKey) ?? {
      operation: operationKey,
      credits: 0,
      calls: 0,
    };
    operation.credits += charged;
    operation.calls += 1;
    operations.set(operationKey, operation);
  }

  const byCredits = <T extends { credits: number; calls: number }>(a: T, b: T) =>
    b.credits - a.credits || b.calls - a.calls;

  return {
    credits,
    calls: rows.length,
    records,
    failures,
    lastAt,
    byUser: [...users.values()].sort(byCredits),
    byOperation: [...operations.values()].sort(byCredits),
  };
}

export interface LushaCreditUsageResult {
  rows: LushaCreditUsageRow[];
  summary: LushaCreditUsageSummary;
}

export function useLushaCreditUsage(limit = 500) {
  const { activeOrgId } = useActiveOrganization();

  return useQuery({
    queryKey: ["lusha-credit-usage", activeOrgId, limit],
    enabled: !!activeOrgId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LushaCreditUsageResult> => {
      const { data, error } = await supabase
        .from("lusha_credit_usage_log")
        .select(USAGE_COLUMNS)
        .eq("organization_id", activeOrgId!)
        .gte("created_at", monthStartIso())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = (data ?? []) as LushaCreditUsageRow[];
      const summary = summarizeLushaCreditUsage(rows);

      const userIds = summary.byUser
        .map((u) => u.userId)
        .filter((id): id is string => !!id);
      if (userIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
        summary.byUser = summary.byUser.map((u) => ({
          ...u,
          name: u.userId ? names.get(u.userId) ?? null : null,
        }));
      }

      return { rows, summary };
    },
  });
}