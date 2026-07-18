// Public REST API authenticated via X-API-Key header
// Endpoints:
//   GET    /me                  (returns current API key info)
//   GET    /companies?limit=&offset=
//   POST   /companies            (write scope)
//   GET    /companies/:id
//   PATCH  /companies/:id        (write scope)
//   DELETE /companies/:id        (write scope)
//   GET    /deals
//   POST   /deals                (write scope)
//   GET    /stakeholders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ALLOWED_TABLES = ["companies", "deals", "stakeholders"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

// Allowlist de colunas graváveis por integradores externos via API pública.
// Antes o POST fazia `{ ...body, user_id }` — o corpo inteiro era gravado,
// então um cliente da API podia injetar organization_id (escrevendo numa
// org alheia), id, ipc_score, enriched, raw_data, version, deleted_at etc.
// Só os campos de negócio legítimos abaixo passam; tudo mais é descartado
// silenciosamente (id/user_id/organization_id são sempre definidos pelo
// servidor, nunca pelo corpo da requisição).
const WRITABLE_COLUMNS: Record<AllowedTable, readonly string[]> = {
  companies: [
    "name", "sector", "location", "website", "phone", "email", "employees",
    "revenue", "cnpj", "linkedin_url", "instagram_url", "description",
    "logo_url", "starred", "lat", "lng",
  ],
  deals: [
    "title", "description", "value", "currency", "company_id",
    "stakeholder_id", "expected_close_date", "closed_at", "priority",
    "tags", "position", "stage_id",
  ],
  stakeholders: [
    "company_id", "full_name", "role", "department", "seniority", "email",
    "phone", "linkedin_url", "avatar_url", "tags", "notes", "last_contacted_at",
  ],
};

function pickWritable(table: AllowedTable, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_COLUMNS[table]) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const url = new URL(req.url);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const logCtx: {
    api_key_id: string | null;
    api_key_prefix: string | null;
    organization_id: string | null;
    user_id: string | null;
    resource: string | null;
  } = { api_key_id: null, api_key_prefix: null, organization_id: null, user_id: null, resource: null };
  let supabaseForLog: ReturnType<typeof createClient> | null = null;

  const respond = async (body: unknown, status = 200, errorMessage?: string) => {
    const res = new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    try {
      const client =
        supabaseForLog ??
        createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
      await client.from("api_request_logs").insert({
        api_key_id: logCtx.api_key_id,
        api_key_prefix: logCtx.api_key_prefix,
        organization_id: logCtx.organization_id,
        user_id: logCtx.user_id,
        method: req.method,
        path: url.pathname,
        resource: logCtx.resource,
        status_code: status,
        duration_ms: Date.now() - startedAt,
        ip_address: ip,
        user_agent: userAgent,
        error_message: errorMessage ?? (status >= 400 ? (typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : null) : null),
      });
    } catch (_) {
      // Never let logging break the response
    }
    return res;
  };

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return await respond({ error: "Missing X-API-Key header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    supabaseForLog = supabase;

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRows, error: keyErr } = await supabase.rpc("verify_api_key", { _key_hash: keyHash });
    if (keyErr || !keyRows?.length) return await respond({ error: "Invalid or expired API key" }, 401);
    const { user_id, scopes, key_id } = keyRows[0];
    await supabase.rpc("touch_api_key", { _key_id: key_id });
    logCtx.api_key_id = key_id;
    logCtx.user_id = user_id;
    // Fetch prefix + org for richer log context (best-effort)
    const { data: keyMeta } = await supabase
      .from("api_keys")
      .select("prefix, organization_id")
      .eq("id", key_id)
      .maybeSingle();
    if (keyMeta) {
      logCtx.api_key_prefix = keyMeta.prefix ?? null;
      logCtx.organization_id = keyMeta.organization_id ?? null;
    }

    // Path is something like /public-api/companies/:id — strip the function prefix
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIdx = parts.indexOf("public-api");
    const segs = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
    const [resource, id] = segs;
    logCtx.resource = resource ?? null;

    if (!resource) return await respond({ error: "Resource required (me|companies|deals|stakeholders)" }, 400);

    // GET /me — return info about the authenticated API key
    if (resource === "me") {
      if (req.method !== "GET") return await respond({ error: "Method not allowed" }, 405);
      const { data: keyRow, error: meErr } = await supabase
        .from("api_keys")
        .select("id, name, prefix, scopes, active, expires_at, last_used_at, created_at, organization_id")
        .eq("id", key_id)
        .maybeSingle();
      if (meErr) return await respond({ error: meErr.message }, 500);
      if (!keyRow) return await respond({ error: "API key not found" }, 404);
      return await respond({
        data: {
          id: keyRow.id,
          name: keyRow.name,
          prefix: keyRow.prefix,
          scopes: keyRow.scopes,
          active: keyRow.active,
          expires_at: keyRow.expires_at,
          last_used_at: keyRow.last_used_at,
          created_at: keyRow.created_at,
          organization_id: keyRow.organization_id,
          user_id,
        },
      });
    }

    if (!ALLOWED_TABLES.includes(resource as AllowedTable)) {
      return await respond({ error: "Unknown resource" }, 404);
    }
    const table = resource as AllowedTable;

    const isWrite = ["POST", "PATCH", "DELETE"].includes(req.method);
    if (isWrite && !scopes.includes("write")) {
      return await respond({ error: "API key lacks 'write' scope" }, 403);
    }

    // GET list
    if (req.method === "GET" && !id) {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const nameFilter = url.searchParams.get("name");
      const sectorFilter = url.searchParams.get("sector");

      let query = supabase
        .from(table)
        .select("*", { count: "exact" })
        .eq("user_id", user_id);

      if (nameFilter) query = query.ilike("name", `%${nameFilter}%`);
      if (sectorFilter) query = query.ilike("sector", `%${sectorFilter}%`);

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });
      if (error) return await respond({ error: error.message }, 500);
      return await respond({ data, total: count, limit, offset });
    }

    // GET single
    if (req.method === "GET" && id) {
      const { data, error } = await supabase
        .from(table).select("*").eq("user_id", user_id).eq("id", id).maybeSingle();
      if (error) return await respond({ error: error.message }, 500);
      if (!data) return await respond({ error: "Not found" }, 404);
      return await respond({ data });
    }

    // POST create
    if (req.method === "POST" && !id) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return await respond({ error: "Invalid JSON body" }, 400);
      const insert = { ...pickWritable(table, body as Record<string, unknown>), user_id };
      const { data, error } = await supabase.from(table).insert(insert).select().single();
      if (error) return await respond({ error: error.message }, 400);
      return await respond({ data }, 201);
    }

    // PATCH update
    if (req.method === "PATCH" && id) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return await respond({ error: "Invalid JSON body" }, 400);
      const patch = pickWritable(table, body as Record<string, unknown>);
      const { data, error } = await supabase
        .from(table).update(patch).eq("user_id", user_id).eq("id", id).select().single();
      if (error) return await respond({ error: error.message }, 400);
      return await respond({ data });
    }

    // DELETE
    if (req.method === "DELETE" && id) {
      const { error } = await supabase.from(table).delete().eq("user_id", user_id).eq("id", id);
      if (error) return await respond({ error: error.message }, 400);
      return await respond({ success: true });
    }

    return await respond({ error: "Method/route not supported" }, 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await respond({ error: msg }, 500);
  }
});