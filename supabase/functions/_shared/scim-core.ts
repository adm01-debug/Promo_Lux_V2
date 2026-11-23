// Pure helpers do endpoint SCIM 2.0 (sem I/O), extraídos para teste unitário.
// Mantidos aqui para que a função scim/index.ts fique testável via deno test.

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

export interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  scim_active: boolean;
  scim_external_id: string | null;
  created_at: string;
}

export interface AuthUserInfo {
  email: string | null;
  fullName: string | null;
}

/**
 * Normaliza o path recebido. Tolera o prefixo do gateway
 * (`/functions/v1/scim`) e o mount direto (`/scim`), sempre retornando
 * um path começando por `/`.
 */
export function normalizeScimPath(pathname: string): string {
  let path = pathname;
  path = path.replace(/^\/functions\/v1\/scim/, "");
  path = path.replace(/^\/scim/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

/** Extrai o filtro `userName eq "valor"` de uma query string SCIM. */
export function parseUserNameFilter(filter: string): string | null {
  const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  return m ? m[1] : null;
}

/** Extrai `active` / `externalId` de um payload PATCH (RFC 7644 §3.5.2). */
export function parsePatchOperations(body: Record<string, unknown>): {
  active?: boolean;
  externalId?: string;
} {
  const result: { active?: boolean; externalId?: string } = {};
  const ops = (body.Operations ?? []) as Array<Record<string, unknown>>;
  for (const op of ops) {
    const opPath = (op.path as string | undefined)?.toLowerCase();
    if (opPath === "active" && typeof op.value === "boolean") result.active = op.value;
    if (opPath === "externalid" && typeof op.value === "string") result.externalId = op.value;
    if (!op.path && op.value && typeof op.value === "object") {
      const v = op.value as Record<string, unknown>;
      if (typeof v.active === "boolean") result.active = v.active;
      if (typeof v.externalId === "string") result.externalId = v.externalId;
    }
  }
  return result;
}

/** Serializa um membro + info do usuário no formato de recurso SCIM User. */
export function toScimUser(
  member: MemberRow,
  info: AuthUserInfo,
  baseUrl: string,
): Record<string, unknown> {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: member.user_id,
    ...(member.scim_external_id ? { externalId: member.scim_external_id } : {}),
    userName: info.email ?? member.user_id,
    ...(info.fullName ? { name: { formatted: info.fullName } } : {}),
    emails: info.email ? [{ value: info.email, primary: true }] : [],
    active: member.scim_active,
    meta: {
      resourceType: "User",
      created: member.created_at,
      location: `${baseUrl}/v2/Users/${member.user_id}`,
    },
  };
}
