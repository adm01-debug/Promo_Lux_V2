import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ActiveSession {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string;
  ip: string;
  is_current: boolean;
}

const SESSIONS_KEY = ["my-sessions"];

function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : "Erro desconhecido");
}

export function useActiveSessions() {
  const qc = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<ActiveSession[]> => {
      const { data, error } = await supabase.rpc("list_my_sessions");
      if (error) throw error;
      return (data ?? []) as ActiveSession[];
    },
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: SESSIONS_KEY });
  }, [qc]);

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc("revoke_my_session", { _session_id: sessionId });
      if (error) throw error;
      if (!data) throw new Error("Sessão não encontrada ou já encerrada");
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Sessão encerrada" });
    },
    onError: (e) =>
      toast({ title: "Falha ao encerrar sessão", description: asError(e).message, variant: "destructive" }),
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("revoke_other_sessions");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (count) => {
      invalidate();
      toast({
        title: count > 0 ? `${count} sessão(ões) encerrada(s)` : "Nenhuma outra sessão ativa",
      });
    },
    onError: (e) =>
      toast({ title: "Falha ao encerrar sessões", description: asError(e).message, variant: "destructive" }),
  });

  return {
    sessions: sessionsQuery.data ?? [],
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error as Error | null,
    revokeSession: revokeSession.mutateAsync,
    revokeOthers: revokeOthers.mutateAsync,
    isSaving: revokeSession.isPending || revokeOthers.isPending,
  };
}

/** Resume o user agent em algo legível: navegador + sistema. */
export function describeUserAgent(ua: string): string {
  if (!ua) return "Dispositivo desconhecido";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    "Navegador";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Linux/.test(ua) ? "Linux" :
    "";
  return os ? `${browser} · ${os}` : browser;
}