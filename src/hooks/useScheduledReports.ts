import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export type ReportMetric = "conversion" | "enrichment" | "pipeline" | "campaigns";
export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface ScheduledReport {
  id: string;
  name: string;
  metric: ReportMetric;
  frequency: ReportFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_utc: number;
  recipients: string[];
  active: boolean;
  last_sent_at: string | null;
  created_at: string;
}

export interface ReportRun {
  id: string;
  report_id: string;
  status: "pending" | "sent" | "failed" | "skipped";
  recipients_count: number;
  error_message: string | null;
  created_at: string;
}

export interface ReportInput {
  name: string;
  metric: ReportMetric;
  frequency: ReportFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_utc: number;
  recipients: string[];
}

const SELECT = "id,name,metric,frequency,day_of_week,day_of_month,hour_utc,recipients,active,last_sent_at,created_at";

export function useScheduledReports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["scheduled_reports", user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("scheduled_reports")
        .select(SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScheduledReport[];
    },
  });

  const runs = useQuery({
    queryKey: ["scheduled_report_runs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("scheduled_report_runs")
        .select("id,report_id,status,recipients_count,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ReportRun[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: ReportInput) => {
      const { error } = await db.from("scheduled_reports").insert(input as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Relatório agendado criado");
    },
    onError: (e: Error) => toast.error("Erro ao criar relatório", { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async (input: ReportInput & { id: string; active: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await db.from("scheduled_reports").update(rest as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Relatório atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from("scheduled_reports").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error("Erro ao alterar status", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: preserva o histórico de envios para auditoria.
      const { error } = await db
        .from("scheduled_reports")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Relatório excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return { ...query, runs, create, update, toggleActive, remove };
}