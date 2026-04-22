/**
 * Role-based permissions matrix for LUX.
 *
 * Roles (from public.app_role enum):
 *   - admin  : full control of the workspace, members and all data
 *   - sdr    : day-to-day operator — can create/edit business data, cannot delete or manage workspace
 *   - viewer : read-only consumer
 *
 * Entities are kept stable so the matrix can be rendered as a grid in the UI.
 */

export type AppRole = "admin" | "sdr" | "viewer";

export type Action = "view" | "create" | "edit" | "delete" | "manage";

export type Entity =
  | "companies"
  | "stakeholders"
  | "deals"
  | "campaigns"
  | "workflows"
  | "scrape_jobs"
  | "integrations"
  | "members"
  | "invites"
  | "audit_logs";

type Matrix = Record<Entity, Record<Action, AppRole[]>>;

const ALL: AppRole[] = ["admin", "sdr", "viewer"];
const WRITE: AppRole[] = ["admin", "sdr"];
const ADMIN_ONLY: AppRole[] = ["admin"];

export const PERMISSION_MATRIX: Matrix = {
  companies:    { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  stakeholders: { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  deals:        { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  campaigns:    { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  workflows:    { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  scrape_jobs:  { view: ALL, create: WRITE, edit: WRITE, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  integrations: { view: ADMIN_ONLY, create: ADMIN_ONLY, edit: ADMIN_ONLY, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  members:      { view: ALL, create: ADMIN_ONLY, edit: ADMIN_ONLY, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  invites:      { view: ALL, create: ADMIN_ONLY, edit: ADMIN_ONLY, delete: ADMIN_ONLY, manage: ADMIN_ONLY },
  audit_logs:   { view: ADMIN_ONLY, create: [], edit: [], delete: [], manage: ADMIN_ONLY },
};

export function can(role: AppRole | null | undefined, entity: Entity, action: Action): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[entity]?.[action]?.includes(role) ?? false;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  sdr: "SDR",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  admin: "Controle total do workspace, membros, integrações e dados.",
  sdr: "Operação diária: cria e edita empresas, deals, campanhas e workflows. Não pode deletar nem gerir o workspace.",
  viewer: "Acesso somente-leitura aos dados de negócio.",
};

export const ENTITY_LABEL: Record<Entity, string> = {
  companies: "Empresas",
  stakeholders: "Stakeholders",
  deals: "Deals",
  campaigns: "Campanhas",
  workflows: "Workflows",
  scrape_jobs: "Scrape jobs",
  integrations: "API & Webhooks",
  members: "Membros",
  invites: "Convites",
  audit_logs: "Audit logs",
};

export const ACTION_LABEL: Record<Action, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Deletar",
  manage: "Gerenciar",
};

export const ENTITIES: Entity[] = Object.keys(PERMISSION_MATRIX) as Entity[];
export const ACTIONS: Action[] = ["view", "create", "edit", "delete", "manage"];
export const ROLES: AppRole[] = ["admin", "sdr", "viewer"];