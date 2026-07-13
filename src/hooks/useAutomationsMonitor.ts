import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Fonte de dados da tela de "Automações em Tempo Real".
 *
 * Consolida três domínios de automação por empresa — raspagem, enrichment e
 * localização — além da fila de execução, tentativas, erros e o fluxo de
 * eventos recentes. Todas as leituras são escopadas por organização via `db`
 * (withOrg) e mantidas ao vivo por subscriptions Realtime.
 */

export type CompanyAutomationRow = Pick<
  Tables<"companies">,
  "id" | "name" | "source" | "enriched" | "ipc_score" | "lat" | "lng" | "updated_at" | "created_at"
>;

export type QueueRow = Tables<"scrape_queue">;
export type EventRow = Tables<"automation_execution_logs">;
export type DeadLetterRow = Tables<"scrape_dead_letter">;

export type AutomationStage = "scraping" | "enrichment" | "localization";
export type StageStatus = "done" | "pending";

/** Deriva o status de cada estágio de automação para uma empresa. */
export function stageStatus(c: CompanyAutomationRow): Record<AutomationStage, StageStatus> {
  const scraped = !!c.source && c.source !== "manual";
  const located = c.lat != null && c.lng != null;
  return {
    scraping: scraped ? "done" : "pending",
    enrichment: c.enriched ? "done" : "pending",
    localization: located ? "done" : "pending",
  };
}

function useCompanies() {
  return useQuery({
    queryKey: ["automations", "companies"],
    queryFn: async (): Promise<CompanyAutomationRow[]> => {
      if (!getActiveOrgId()) return [];
      const { data, error } = await db
        .from("companies")
        .select("id,name,source,enriched,ipc_score,lat,lng,updated_at,created_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CompanyAutomationRow[];
    },
    refetchInterval: 30_000,
  });
}

function useQueue() {
  return useQuery({
    queryKey: ["automations", "queue"],
    queryFn: async (): Promise<QueueRow[]> => {
      if (!getActiveOrgId()) return [];
      const { data, error } = await db
        .from("scrape_queue")
        .select("*")
        .order("next_run_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as QueueRow[];
    },
    refetchInterval: 15_000,
  });
}

function useEvents() {
  return useQuery({
    queryKey: ["automations", "events"],
    queryFn: async (): Promise<EventRow[]> => {
      if (!getActiveOrgId()) return [];
      const { data, error } = await db
        .from("automation_execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    refetchInterval: 15_000,
  });
}

function useDeadLetter() {
  return useQuery({
    queryKey: ["automations", "dead-letter"],
    queryFn: async (): Promise<DeadLetterRow[]> => {
      if (!getActiveOrgId()) return [];
      const { data, error } = await db
        .from("scrape_dead_letter")
        .select("*")
        .is("replayed_at", null)
        .order("failed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DeadLetterRow[];
    },
    refetchInterval: 30_000,
  });
}

/** Subscreve Realtime para invalidar as queries de automação ao vivo. */
function useRealtimeInvalidation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const activeOrgId = getActiveOrgId();

  useEffect(() => {
    if (!user?.id || !activeOrgId) return;

    const invalidate = (key: string) =>
      qc.invalidateQueries({ queryKey: ["automations", key] });

    const filter = `organization_id=eq.${activeOrgId}`;
    const channel = supabase
      .channel(`org:${activeOrgId}:automations`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter }, () => invalidate("companies"))
      .on("postgres_changes", { event: "*", schema: "public", table: "scrape_queue", filter }, () => invalidate("queue"))
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_execution_logs", filter }, () => invalidate("events"))
      .on("postgres_changes", { event: "*", schema: "public", table: "scrape_dead_letter", filter }, () => invalidate("dead-letter"))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, user?.id, activeOrgId]);
}

export interface AutomationKpis {
  totalCompanies: number;
  scraped: number;
  enriched: number;
  located: number;
  queued: number;
  processing: number;
  errors: number;
}

export function useAutomationsMonitor() {
  const companies = useCompanies();
  const queue = useQueue();
  const events = useEvents();
  const deadLetter = useDeadLetter();
  useRealtimeInvalidation();

  const kpis: AutomationKpis = useMemo(() => {
    const rows = companies.data ?? [];
    const q = queue.data ?? [];
    return {
      totalCompanies: rows.length,
      scraped: rows.filter((c) => !!c.source && c.source !== "manual").length,
      enriched: rows.filter((c) => c.enriched).length,
      located: rows.filter((c) => c.lat != null && c.lng != null).length,
      queued: q.filter((t) => t.status === "queued").length,
      processing: q.filter((t) => t.status === "processing").length,
      errors: (deadLetter.data ?? []).length,
    };
  }, [companies.data, queue.data, deadLetter.data]);

  return {
    companies: companies.data ?? [],
    queue: queue.data ?? [],
    events: events.data ?? [],
    deadLetter: deadLetter.data ?? [],
    kpis,
    isLoading:
      companies.isLoading || queue.isLoading || events.isLoading || deadLetter.isLoading,
    refetchAll: () => {
      companies.refetch();
      queue.refetch();
      events.refetch();
      deadLetter.refetch();
    },
  };
}
