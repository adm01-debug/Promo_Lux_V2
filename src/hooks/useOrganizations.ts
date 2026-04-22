import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export interface OrgMembership {
  organization_id: string;
  role: AppRole;
  organizations: { id: string; name: string; slug: string; owner_id: string };
}
export interface Member {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
export interface Invite {
  id: string;
  token: string;
  role: AppRole;
  created_by: string;
  expires_at: string;
  revoked: boolean;
  accepted_at: string | null;
  created_at: string;
}

const STORAGE_KEY = "lux:active-org";

export function useMyOrganizations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-organizations", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<OrgMembership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations!inner(id, name, slug, owner_id)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OrgMembership[];
    },
  });
}

export function useActiveOrganization() {
  const { data: orgs } = useMyOrganizations();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  useEffect(() => {
    if (!orgs || orgs.length === 0) return;
    const valid = orgs.find(o => o.organization_id === activeId);
    if (!valid) {
      const first = orgs[0].organization_id;
      setActiveId(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [orgs, activeId]);

  const setActive = useCallback((id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Invalidate all workspace-scoped data so it refetches under the new org
    qc.invalidateQueries();
    // Notify other tabs / listeners
    window.dispatchEvent(new CustomEvent("lux:active-org-changed", { detail: { id } }));
  }, [activeId, qc]);

  const active = useMemo(
    () => (orgs ?? []).find(o => o.organization_id === activeId) ?? null,
    [orgs, activeId]
  );

  return { activeOrgId: activeId, activeOrg: active, setActive };
}

export function useOrgMembers(orgId: string | null) {
  return useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrgInvites(orgId: string | null) {
  return useQuery({
    queryKey: ["org-invites", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id, token, role, created_by, expires_at, revoked, accepted_at, created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const slug = name.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 7);
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name: name.trim(), slug, owner_id: user.id })
        .select("id, name, slug")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-organizations"] }),
  });
}

export function useCreateInvite(orgId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ role }: { role: AppRole }) => {
      if (!orgId || !user?.id) throw new Error("Org ou usuário ausente");
      const { data, error } = await supabase
        .from("organization_invites")
        .insert({ organization_id: orgId, role, created_by: user.id })
        .select("id, token")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", orgId] }),
  });
}

export function useRevokeInvite(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organization_invites")
        .update({ revoked: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", orgId] }),
  });
}

export function useUpdateMemberRole(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

export function useRemoveMember(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}
