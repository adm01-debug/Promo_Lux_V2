import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "@/hooks/use-toast";

export type DsarRequestType = "access" | "portability" | "erasure" | "rectification";
export type DsarStatus = "pending" | "processing" | "completed" | "rejected";

export interface DsarRequest {
  id: string;
  request_type: DsarRequestType;
  subject_email: string;
  subject_name: string | null;
  status: DsarStatus;
  requested_at: string;
  due_at: string;
  completed_at: string | null;
  days_remaining: number;
  is_overdue: boolean;
  legal_basis: string | null;
  notes: string | null;
  result_summary: Record<string, unknown> | null;
}

export interface DsarSlaAlert {
  id: string;
  request_type: DsarRequestType;
  subject_email: string;
  due_at: string;
  days_remaining: number;
  is_overdue: boolean;
}

function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : "Erro desconhecido");
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useDsar() {
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["dsar-requests", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<DsarRequest[]> => {
      const { data, error } = await supabase.rpc("list_dsar_requests", { _org_id: activeOrgId! });
      if (error) throw error;
      return (data ?? []) as DsarRequest[];
    },
  });

  const slaQuery = useQuery({
    queryKey: ["dsar-sla", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async (): Promise<DsarSlaAlert[]> => {
      const { data, error } = await supabase.rpc("dsar_sla_alerts", {
        _org_id: activeOrgId!,
        _within_days: 7,
      });
      if (error) throw error;
      return (data ?? []) as DsarSlaAlert[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async (input: {
      requestType: DsarRequestType;
      subjectEmail: string;
      subjectName?: string;
      legalBasis?: string;
      notes?: string;
    }) => {
      if (!activeOrgId) throw new Error("Organização não selecionada");
      const { data, error } = await supabase.rpc("create_dsar_request", {
        _org_id: activeOrgId,
        _request_type: input.requestType,
        _subject_email: input.subjectEmail,
        _subject_name: input.subjectName ?? undefined,
        _legal_basis: input.legalBasis ?? undefined,
        _notes: input.notes ?? undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsar-requests", activeOrgId] });
      queryClient.invalidateQueries({ queryKey: ["dsar-sla", activeOrgId] });
      toast({ title: "Pedido registrado", description: "Prazo legal de 30 dias iniciado." });
    },
    onError: (e) =>
      toast({ title: "Falha ao registrar pedido", description: asError(e).message, variant: "destructive" }),
  });

  /** Executa export ou erasure e baixa o comprovante. */
  const fulfill = useCallback(
    async (requestId: string) => {
      if (!activeOrgId) return;
      setBusyId(requestId);
      try {
        const { data, error } = await supabase.rpc("fulfill_dsar_request", {
          _org_id: activeOrgId,
          _request_id: requestId,
          _notes: undefined,
        });
        if (error) throw error;
        const result = data as { status: string; request_type?: string; result?: unknown };
        if (result?.status === "completed" && result.result) {
          downloadJson(
            result.result,
            `dsar-${result.request_type ?? "request"}-${new Date().toISOString().slice(0, 10)}.json`,
          );
        }
        queryClient.invalidateQueries({ queryKey: ["dsar-requests", activeOrgId] });
        queryClient.invalidateQueries({ queryKey: ["dsar-sla", activeOrgId] });
        toast({
          title: result?.status === "already_completed" ? "Pedido já atendido" : "Pedido atendido",
          description: "Comprovante baixado.",
        });
      } catch (e) {
        toast({ title: "Falha ao atender pedido", description: asError(e).message, variant: "destructive" });
      } finally {
        setBusyId(null);
      }
    },
    [activeOrgId, queryClient],
  );

  /** Pré-visualiza a portabilidade sem registrar um pedido. */
  const previewSubject = useCallback(
    async (email: string) => {
      if (!activeOrgId) return;
      try {
        const { data, error } = await supabase.rpc("export_subject_data", {
          _org_id: activeOrgId,
          _subject_email: email,
        });
        if (error) throw error;
        downloadJson(data, `titular-${new Date().toISOString().slice(0, 10)}.json`);
        toast({ title: "Dados do titular exportados" });
      } catch (e) {
        toast({ title: "Falha ao exportar", description: asError(e).message, variant: "destructive" });
      }
    },
    [activeOrgId],
  );

  return {
    requests: requestsQuery.data ?? [],
    isLoading: requestsQuery.isLoading,
    error: requestsQuery.error ? asError(requestsQuery.error) : null,
    slaAlerts: slaQuery.data ?? [],
    createRequest,
    fulfill,
    previewSubject,
    busyId,
  };
}