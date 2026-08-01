import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico de polling/sincronização de uma conta de e-mail.
 * Cada linha é uma execução do edge function `email-poll-replies` para a conta.
 *
 * Permite responder visualmente:
 *  - Quando começou a falhar?
 *  - Quantas tentativas de auto-reconexão já ocorreram e o que retornaram?
 *  - Qual o resultado da última sincronização bem-sucedida?
 */
export type EmailSyncStatus = "success" | "error" | "skipped" | "refresh_failed";

export interface EmailSyncLogEntry {
  id: string;
  email_account_id: string;
  organization_id: string;
  scope_type: "user" | "organization";
  provider: string;
  status: EmailSyncStatus;
  scanned: number | null;
  inserted: number | null;
  attempt: number | null;
  max_attempts: number | null;
  next_retry_at: string | null;
  reconnect_required: boolean;
  fatal: boolean | null;
  skipped_reason: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Lista paginada do histórico de sync de UMA conta.
 * Busca `pageSize+1` para detectar `hasMore` sem `count: exact`.
 */
export function useEmailSyncLog(
  accountId: string | null,
  page = 0,
  pageSize = 20,
) {
  return useQuery({
    queryKey: ["email-sync-log", accountId, page, pageSize],
    enabled: !!accountId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize;
      const { data, error } = await supabase
        .from("email_sync_log")
        .select(
          "id,email_account_id,organization_id,scope_type,provider,status,scanned,inserted,attempt,max_attempts,next_retry_at,reconnect_required,fatal,skipped_reason,error_message,duration_ms,created_at",
        )
        .eq("email_account_id", accountId!)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []) as EmailSyncLogEntry[];
      const hasMore = rows.length > pageSize;
      return {
        entries: hasMore ? rows.slice(0, pageSize) : rows,
        hasMore,
        page,
        pageSize,
      };
    },
    refetchOnWindowFocus: false,
  });
}