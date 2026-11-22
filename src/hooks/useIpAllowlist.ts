import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { toast } from "@/hooks/use-toast";

export interface IpRule {
  id: string;
  organization_id: string;
  cidr: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpStatus {
  allowed: boolean;
  enabled: boolean;
  ip: string | null;
  rules: number;
}

function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : "Erro desconhecido");
}

export function useIpAllowlist() {
  const { activeOrgId } = useActiveOrganization();
  const orgId = activeOrgId;
  const qc = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["ip-allowlist", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<IpRule[]> => {
      const { data, error } = await supabase
        .from("ip_allowlist")
        .select("id, organization_id, cidr, label, created_by, created_at, updated_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IpRule[];
    },
  });

  const statusQuery = useQuery({
    queryKey: ["ip-status", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<IpStatus> => {
      await supabase.rpc("touch_last_known_ip");
      const { data, error } = await supabase.rpc("get_my_ip_status");
      if (error) throw error;
      const raw = (data ?? {}) as Partial<IpStatus>;
      return {
        allowed: raw.allowed ?? true,
        enabled: raw.enabled ?? false,
        ip: raw.ip ?? null,
        rules: raw.rules ?? 0,
      };
    },
  });

  const orgQuery = useQuery({
    queryKey: ["org-ip-allowlist-enabled", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("ip_allowlist_enabled")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { ip_allowlist_enabled?: boolean } | null)?.ip_allowlist_enabled ?? false;
    },
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["ip-allowlist", orgId] });
    qc.invalidateQueries({ queryKey: ["ip-status", orgId] });
    qc.invalidateQueries({ queryKey: ["org-ip-allowlist-enabled", orgId] });
  }, [qc, orgId]);

  const addRule = useMutation({
    mutationFn: async (input: { cidr: string; label?: string | null }) => {
      if (!orgId) throw new Error("Organização não selecionada");
      const { error } = await supabase.from("ip_allowlist").insert({
        organization_id: orgId,
        cidr: input.cidr.trim(),
        label: input.label?.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Regra adicionada" });
    },
    onError: (e) => toast({ title: "Falha ao adicionar", description: asError(e).message, variant: "destructive" }),
  });

  const removeRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ip_allowlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Regra removida" });
    },
    onError: (e) => toast({ title: "Falha ao remover", description: asError(e).message, variant: "destructive" }),
  });

  const setEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!orgId) throw new Error("Organização não selecionada");
      const { error } = await supabase
        .from("organizations")
        .update({ ip_allowlist_enabled: enabled })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      invalidate();
      toast({ title: enabled ? "Bloqueio de IP ativado" : "Bloqueio de IP desativado" });
    },
    onError: (e) => toast({ title: "Falha ao alterar", description: asError(e).message, variant: "destructive" }),
  });

  return {
    rules: rulesQuery.data ?? [],
    status: statusQuery.data ?? { allowed: true, enabled: false, ip: null, rules: 0 },
    enabled: orgQuery.data ?? false,
    isLoading: rulesQuery.isLoading || statusQuery.isLoading || orgQuery.isLoading,
    error: (rulesQuery.error ?? statusQuery.error ?? orgQuery.error) as Error | null,
    addRule: addRule.mutateAsync,
    removeRule: removeRule.mutateAsync,
    setEnabled: setEnabled.mutateAsync,
    isSaving: addRule.isPending || removeRule.isPending || setEnabled.isPending,
  };
}