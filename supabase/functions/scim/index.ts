// SCIM 2.0 provisioning endpoint.
//
// Base URL: {SUPABASE_URL}/functions/v1/scim/v2
// Auth:     Authorization: Bearer <scim_token>  +  X-Org-Id: <org_uuid>
//
// Routes:
//   GET    /v2/ServiceProviderConfig
//   GET    /v2/Users?filter=userName eq "email"&startIndex=1&count=100
//   GET    /v2/Users/:id
//   POST   /v2/Users
//   PUT    /v2/Users/:id
//   PATCH  /v2/Users/:id
//   DELETE /v2/Users/:id
//
// Identidade: o `id` do recurso SCIM é o `user_id` (auth.users.id), estável entre
// renomeações/rotação de e-mail. E-mail e nome vêm da Admin API (service_role),
// pois `auth.users` não é exposto pelo PostgREST.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type AuthUserInfo,
  type MemberRow,
  normalizeScimPath,
  parsePatchOperations,
  parseUserNameFilter,
  SCIM_LIST_SCHEMA,
  toScimUser,
} from "../_shared/scim-core.ts";

const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-org-id, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const SCIM_CONTENT_TYPE = "application/scim+json";

function scimJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": SCIM_CONTENT_TYPE },
  });
}

function scimError(detail: string, status: number, scimType?: string) {
  return scimJson(
    {
      schemas: [SCIM_ERROR_SCHEMA],
      detail,
      ...(scimType ? { scimType } : {}),
      status: String(status),
    },
    status,
  );
}

const MEMBER_COLS = "id, organization_id, user_id, role, scim_active, scim_external_id, created_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const baseUrl = `${url.origin}${url.pathname.replace(/\/v2\/.*$/, "")}`;
  const path = normalizeScimPath(url.pathname);

  const orgId = req.headers.get("x-org-id")?.trim();
  if (!orgId) return scimError("Header X-Org-Id obrigatorio", 400, "invalidValue");

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return scimError("Authorization Bearer token obrigatorio", 401, "invalidValue");

  const { data: tokenValid, error: tokenErr } = await admin.rpc("verify_scim_token", {
    p_org_id: orgId,
    p_token: token,
  });
  if (tokenErr || !tokenValid) {
    return scimError("Token invalido ou nao configurado", 401, "invalidValue");
  }

  // ── ServiceProviderConfig ────────────────────────────────────────────────
  if (path === "/v2/ServiceProviderConfig" && req.method === "GET") {
    return scimJson({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      documentationUri: "https://datatracker.ietf.org/doc/html/rfc7644",
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "Bearer Token",
          description: "SCIM Bearer Token da organizacao",
          primary: true,
        },
      ],
    });
  }

  // E-mail/nome a partir da Admin API (auth.users)
  async function userInfo(userId: string): Promise<AuthUserInfo> {
    const { data } = await admin.auth.admin.getUserById(userId);
    const u = data?.user;
    if (!u) return { email: null, fullName: null };
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    return {
      email: u.email ?? null,
      fullName: (meta.full_name as string | undefined) ?? null,
    };
  }

  // ── List Users ───────────────────────────────────────────────────────────
  if (path === "/v2/Users" && req.method === "GET") {
    const filter = url.searchParams.get("filter") ?? "";
    const startIndex = Math.max(1, parseInt(url.searchParams.get("startIndex") ?? "1", 10) || 1);
    const count = Math.min(200, parseInt(url.searchParams.get("count") ?? "100", 10) || 100);

    const { data: members, error } = await admin
      .from("organization_members")
      .select(MEMBER_COLS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return scimError(error.message, 500);

    const userNameFilter = parseUserNameFilter(filter);
    const resources: Record<string, unknown>[] = [];
    for (const member of (members ?? []) as MemberRow[]) {
      const info = await userInfo(member.user_id);
      if (
        userNameFilter &&
        (info.email ?? "").toLowerCase() !== userNameFilter.toLowerCase()
      ) {
        continue;
      }
      resources.push(toScimUser(member, info, baseUrl));
    }

    const page = resources.slice(startIndex - 1, startIndex - 1 + count);
    return scimJson({
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: resources.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page,
    });
  }

  // ── Get / Update / Patch / Delete User ───────────────────────────────────
  const userMatch = path.match(/^\/v2\/Users\/([^/]+)$/);

  if (userMatch && req.method === "GET") {
    const userId = userMatch[1];
    const { data: member, error } = await admin
      .from("organization_members")
      .select(MEMBER_COLS)
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (error || !member) return scimError("User not found", 404);
    const info = await userInfo(userId);
    return scimJson(toScimUser(member as MemberRow, info, baseUrl));
  }

  // ── Create User ──────────────────────────────────────────────────────────
  if (path === "/v2/Users" && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return scimError("JSON invalido", 400, "invalidSyntax");
    }

    const emails = body.emails as Array<{ value?: string }> | undefined;
    const email = (emails?.[0]?.value ?? body.userName) as string | undefined;
    const nameObj = body.name as Record<string, unknown> | undefined;
    const displayName = (nameObj?.formatted ?? body.displayName ?? email) as string | undefined;
    const externalId = body.externalId as string | undefined;
    const active = body.active === undefined ? true : !!body.active;

    if (!email) return scimError("emails[0].value ou userName obrigatorio", 400, "invalidValue");

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: displayName ? { full_name: displayName } : {},
    });

    if (createErr || !created.user) {
      return scimError(createErr?.message ?? "Falha ao criar usuario", 409, "uniqueness");
    }
    const newUserId = created.user.id;

    const { data: member, error: memErr } = await admin
      .from("organization_members")
      .insert({
        organization_id: orgId,
        user_id: newUserId,
        role: "viewer",
        scim_active: active,
        scim_external_id: externalId ?? null,
      })
      .select(MEMBER_COLS)
      .single();

    if (memErr) {
      // Rollback: remove o usuario criado para nao deixar orfao no GoTrue
      await admin.auth.admin.deleteUser(newUserId).catch(() => {});
      return scimError(memErr.message, 409, "uniqueness");
    }

    const info = await userInfo(newUserId);
    return scimJson(toScimUser(member as MemberRow, info, baseUrl), 201);
  }

  // ── Update (PUT) / Patch (PATCH) ─────────────────────────────────────────
  if (userMatch && (req.method === "PUT" || req.method === "PATCH")) {
    const userId = userMatch[1];
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return scimError("JSON invalido", 400, "invalidSyntax");
    }

    let active: boolean | undefined;
    let externalId: string | undefined;

    if (req.method === "PATCH") {
      const parsed = parsePatchOperations(body);
      active = parsed.active;
      externalId = parsed.externalId;
    } else {
      if (typeof body.active === "boolean") active = body.active;
      if (typeof body.externalId === "string") externalId = body.externalId;
    }

    const updateData: Record<string, unknown> = {};
    if (active !== undefined) updateData.scim_active = active;
    if (externalId !== undefined) updateData.scim_external_id = externalId;

    if (Object.keys(updateData).length === 0) {
      return scimError("Nenhum campo suportado para atualizar", 400, "invalidValue");
    }

    const { data: member, error } = await admin
      .from("organization_members")
      .update(updateData)
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .select(MEMBER_COLS)
      .single();

    if (error || !member) return scimError("User not found", 404);
    const info = await userInfo(userId);
    return scimJson(toScimUser(member as MemberRow, info, baseUrl));
  }

  // ── Delete (Deprovision) ─────────────────────────────────────────────────
  if (userMatch && req.method === "DELETE") {
    const userId = userMatch[1];
    // Soft deprovision: mantém histórico/auditoria; IdP readicionando reativa.
    const { error } = await admin
      .from("organization_members")
      .update({ scim_active: false })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return scimError(error.message, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return scimError("Endpoint nao encontrado", 404);
});
