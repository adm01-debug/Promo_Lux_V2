import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOrgMembers, useActiveOrganization } from "@/hooks/useOrganizations";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { can, type Action, type Entity, type AppRole } from "@/lib/permissions";

/** Ação da UI → coluna da matriz no banco. */
const FLAG: Record<Action, "can_view" | "can_create" | "can_update" | "can_delete" | "can_manage"> = {
  view: "can_view",
  create: "can_create",
  edit: "can_update",
  delete: "can_delete",
  manage: "can_manage",
};

/**
 * Returns the current user's role in the active workspace and helper `can(entity, action)`.
 *
 * A permissão vem de `public.role_permissions` (editável pelo admin). Enquanto a
 * matriz carrega, ou se a organização ainda não tem linhas, cai no mapa estático
 * de `src/lib/permissions.ts` — que é exatamente o que a migration semeia, então
 * o resultado é o mesmo; só evita um flicker de UI durante o fetch.
 *
 * Fallback de papel: sem vínculo (ex.: escopo pessoal sem workspace) o usuário é
 * tratado como `admin` do próprio escopo para o app continuar utilizável. A RLS
 * continua sendo a fonte de verdade no backend.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { activeOrgId, activeOrg } = useActiveOrganization();
  const { data: members } = useOrgMembers(activeOrgId);
  const { byKey } = useRolePermissions();

  const role: AppRole | null = useMemo(() => {
    if (!user?.id) return null;
    if (!activeOrgId) return "admin"; // personal scope
    const m = (members ?? []).find((mm) => mm.user_id === user.id);
    return (m?.role as AppRole | undefined) ?? null;
  }, [user?.id, activeOrgId, members]);

  const isOwner = !!(activeOrg && user?.id && (activeOrg as { organizations?: { owner_id?: string } }).organizations?.owner_id === user.id);

  const canDo = (entity: Entity, action: Action): boolean => {
    if (!role) return false;
    const row = byKey.get(`${entity}|${role}`);
    if (row) return row[FLAG[action]];
    return can(role, entity, action);
  };

  return {
    role,
    isOwner,
    isAdmin: role === "admin",
    isSDR: role === "sdr",
    isViewer: role === "viewer",
    can: canDo,
  };
}

/** Convenience boolean hook: useCan('companies','delete'). */
export function useCan(entity: Entity, action: Action): boolean {
  return usePermissions().can(entity, action);
}