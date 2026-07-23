import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";

export type DlqMotor = "instagram" | "web";

export interface DlqReplayResult {
  replayed: number;
  skipped: number;
  errors: number;
}

export interface DlqReplayInput {
  organization_id: string;
  dlq_ids?: string[];
  limit?: number;
  reason?: string;
}

/** Item de DLQ unificado para renderização (Instagram + Web). */
export interface DlqReplayItem {
  id: string;
  motor: DlqMotor;
  target: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

async function extractError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.text();
      return body || err.message;
    } catch {
      return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

async function invokeReplay(
  motor: DlqMotor,
  input: DlqReplayInput,
): Promise<DlqReplayResult> {
  const fn = motor === "instagram" ? "instagram-dlq-replay" : "web-dlq-replay";
  const { data, error } = await supabase.functions.invoke(fn, { body: input });
  if (error) throw new Error(await extractError(error));
  const result = (data as { result?: DlqReplayResult })?.result;
  return {
    replayed: result?.replayed ?? 0,
    skipped: result?.skipped ?? 0,
    errors: result?.errors ?? 0,
  };
}

export function useDlqReplayList(motor: DlqMotor, limit = 50) {
  const { activeOrgId } = useActiveOrganization();
  return useQuery({
    queryKey: ["dlq-replay-list", motor, activeOrgId, limit],
    enabled: !!activeOrgId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<DlqReplayItem[]> => {
      if (motor === "instagram") {
        const { data, error } = await supabase
          .from("instagram_scrape_dead_letter")
          .select("id, target_type, target_value, attempts, last_error, created_at")
          .eq("organization_id", activeOrgId!)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data ?? []).map((r) => ({
          id: r.id,
          motor,
          target: `${r.target_type}: ${r.target_value}`,
          attempts: r.attempts ?? 0,
          last_error: r.last_error,
          created_at: r.created_at,
        }));
      }
      const { data, error } = await supabase
        .from("web_scrape_dead_letter")
        .select("id, url, attempts, last_error, failed_at, created_at, replayed_at")
        .eq("organization_id", activeOrgId!)
        .is("replayed_at", null)
        .order("failed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        motor,
        target: r.url,
        attempts: r.attempts ?? 0,
        last_error: r.last_error,
        created_at: r.failed_at ?? r.created_at,
      }));
    },
  });
}

export function useDlqReplay(motor: DlqMotor) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DlqReplayInput) => invokeReplay(motor, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dlq-replay-list", motor] });
      qc.invalidateQueries({ queryKey: ["dlq-items"] });
      qc.invalidateQueries({ queryKey: ["dlq-health-metrics"] });
    },
  });
}
