import { ReactNode } from "react";
import { useCan } from "@/hooks/usePermissions";
import type { Action, Entity } from "@/lib/permissions";

interface Props {
  entity: Entity;
  action: Action;
  children: ReactNode;
  /** Render this when the user lacks the permission instead of nothing. */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the active workspace role.
 * Backend RLS is the source of truth; this is purely UX hinting.
 */
export const PermissionGate = ({ entity, action, children, fallback = null }: Props) => {
  const allowed = useCan(entity, action);
  return <>{allowed ? children : fallback}</>;
};