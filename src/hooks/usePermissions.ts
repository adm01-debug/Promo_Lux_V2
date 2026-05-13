import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers, useActiveOrganization } from "@/hooks/useOrganizations";
import { can, type Action, type Entity, type AppRole } from "@/lib/permissions";

/**
 * Returns the current user's role in the active workspace and helper `can(entity, action)`.
 *
 * Fallback: if the user has no membership yet (e.g. no workspace created), they are
 * treated as `admin` of their personal scope so the app remains usable. RLS policies
 * still enforce data isolation on the backend.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const { data: members } = useOrgMembers(activeOrgId);

  const role: AppRole | null = useMemo(() => {
    if (!user?.id) return null;
    if (!activeOrgId) return "admin"; // personal scope
    const m = (members ?? []).find((mm) => mm.user_id === user.id);
    return (m?.role as AppRole | undefined) ?? null;
  }, [user?.id, activeOrgId, members]);

  const isOwner = !!(activeOrg && user?.id && (activeOrg as any).organizations?.owner_id === user.id);

  return {
    role,
    isOwner,
    isAdmin: role === "admin",
    isSDR: role === "sdr",
    isViewer: role === "viewer",
    can: (entity: Entity, action: Action) => can(role, entity, action),
  };
}

/** Convenience boolean hook: useCan('companies','delete'). */
export function useCan(entity: Entity, action: Action): boolean {
  return usePermissions().can(entity, action);
}