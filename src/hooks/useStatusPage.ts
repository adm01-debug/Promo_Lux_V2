import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComponentState = "operational" | "degraded" | "outage" | "unknown";

export type StatusComponent = {
  component: string;
  state: ComponentState;
  events_24h: number | null;
  failures_24h: number | null;
  last_event_at: string | null;
};

export type PublicIncident = {
  id: string;
  title: string;
  impact: "none" | "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  components: string[];
  body: string | null;
  started_at: string;
  resolved_at: string | null;
};

export type PublicStatus = {
  generated_at: string;
  overall: ComponentState;
  components: StatusComponent[];
  incidents: PublicIncident[];
};

export type UptimeDay = {
  day: string;
  events: number;
  failures: number;
  uptime_pct: number | null;
};

export type Incident = {
  id: string;
  organization_id: string;
  title: string;
  impact: PublicIncident["impact"];
  status: PublicIncident["status"];
  components: string[];
  body: string | null;
  postmortem: string | null;
  started_at: string;
  resolved_at: string | null;
};

export const STATE_LABEL: Record<ComponentState, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  outage: "Fora do ar",
  unknown: "Sem dados",
};

export const IMPACT_LABEL: Record<PublicIncident["impact"], string> = {
  none: "Nenhum",
  minor: "Menor",
  major: "Maior",
  critical: "Crítico",
};

export const INCIDENT_STATUS_LABEL: Record<PublicIncident["status"], string> = {
  investigating: "Investigando",
  identified: "Identificado",
  monitoring: "Monitorando",
  resolved: "Resolvido",
};

/** Snapshot publico. RPC anonima: nao exige sessao. */
export function usePublicStatus() {
  return useQuery({
    queryKey: ["public-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_status");
      if (error) throw error;
      return data as unknown as PublicStatus;
    },
    refetchInterval: 60_000,
  });
}

export function usePublicUptime(days = 30) {
  return useQuery({
    queryKey: ["public-uptime", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_uptime", { _days: days });
      if (error) throw error;
      return (data ?? []) as UptimeDay[];
    },
  });
}

/** Lista de incidentes para o operador (RLS por organizacao). */
export function useIncidents() {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .is("deleted_at", null)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Incident[];
    },
  });
}

export function useSaveIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      impact: PublicIncident["impact"];
      status: PublicIncident["status"];
      components: string[];
      body?: string | null;
      resolved_at?: string | null;
    }) => {
      const payload = {
        title: input.title.trim(),
        impact: input.impact,
        status: input.status,
        components: input.components,
        body: input.body ?? null,
        resolved_at: input.status === "resolved" ? (input.resolved_at ?? new Date().toISOString()) : null,
      };
      if (input.id) {
        const { error } = await supabase.from("incidents").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("incidents")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
    },
  });
}

export function useResolveIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("incidents")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
    },
  });
}