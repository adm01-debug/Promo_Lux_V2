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
//   GET    /events?limit=&after=&table=&action=  (Zapier polling trigger)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  noteRateLimitSuccess,
  parseRateLimitDecision,
  retryAfterSeconds,
  withinFailOpenTolerance,
} from "../_shared/api-rate-limit.ts";

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

// Limite de requisições por API key por hora (janela fixa, server-side)
const API_RATE_LIMIT_PER_HOUR = 600;

const ALLOWED_TABLES = ["companies", "deals", "stakeholders"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

// Lixeira (ADR-008): `companies` e `deals` tem `deleted_at`; `stakeholders`
// nao tem a coluna. A API publica so exclui o que da para mandar para a
// lixeira — apagar stakeholder em definitivo com a chave mestra era justamente
// o buraco encontrado na etapa 044.
const SOFT_DELETE_TABLES: readonly AllowedTable[] = ["companies", "deals"];

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

// Client do supabase-js derivado da fabrica abaixo: sem o tipo Database gerado
// (nao existe no repo), os generics ficam implicitos e nao ha `any` escrito.
function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

type SupabaseApiClient = ReturnType<typeof createAdminClient>;

type ApiKeyAuth = {
  key_id: string;
  user_id: string;
  scopes: string[];
  prefix: string | null;
  organization_id: string | null;
  rateLimit: unknown;
};

// Payload das RPCs de um round-trip (public_api_me / public_api_events / public_api_list).
type OneRoundTripResult = {
  status?: number;
  key_id?: string | null;
  user_id?: string | null;
  prefix?: string | null;
  organization_id?: string | null;
  current_count?: number | null;
  reset_at?: string | null;
  key?: Record<string, unknown> | null;
  events?: Array<Record<string, unknown>> | null;
  next_cursor?: string | null;
  items?: Array<Record<string, unknown>> | null;
  total?: number | null;
};

// Autentica a API key e devolve metadados + decisao de rate limit em UM
// round-trip (RPC authenticate_api_key: valida, marca last_used_at, conta a
// janela e devolve prefix/org). Enquanto a migration dessa RPC nao estiver
// aplicada na instancia, cai no caminho historico de 4 round-trips.
// Etapa 038: distingue falha de infraestrutura (503) de chave invalida (401).
class RateLimitUnavailableError extends Error {
  constructor(detail: string) {
    super(`rate limit unavailable: ${detail}`);
    this.name = "RateLimitUnavailableError";
  }
}

async function authenticateApiKey(supabase: SupabaseApiClient, keyHash: string): Promise<ApiKeyAuth | null> {
  const { data, error } = await supabase.rpc("authenticate_api_key", {
    _key_hash: keyHash,
    _limit: API_RATE_LIMIT_PER_HOUR,
  });

  if (!error) {
    const row = (data ?? [])[0] as {
      key_id: string;
      user_id: string;
      scopes: string[] | null;
      prefix: string | null;
      organization_id: string | null;
      allowed: boolean | null;
      current_count: number | null;
      reset_at: string | null;
    } | undefined;
    if (!row) return null;
    if (typeof row.allowed === "boolean") noteRateLimitSuccess();
    return {
      key_id: row.key_id,
      user_id: row.user_id,
      scopes: row.scopes ?? [],
      prefix: row.prefix ?? null,
      organization_id: row.organization_id ?? null,
      rateLimit: { allowed: row.allowed, current_count: row.current_count, reset_at: row.reset_at },
    };
  }

  const missingFunction = error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
  if (!missingFunction) {
    // Etapa 038: erro de infraestrutura nao e "chave invalida". Esta RPC faz
    // autenticacao e contagem no mesmo statement, entao sem ela nao ha como
    // saber de quem e a chave: 503 e a resposta honesta.
    throw new RateLimitUnavailableError(error.message ?? "rpc error");
  }

  const { data: keyRows, error: keyErr } = await supabase.rpc("verify_api_key", { _key_hash: keyHash });
  if (keyErr || !keyRows?.length) return null;
  const legacy = keyRows[0] as { user_id: string; scopes: string[] | null; key_id: string };
  await supabase.rpc("touch_api_key", { _key_id: legacy.key_id });
  const { data: rl, error: rlErr } = await supabase.rpc("check_api_key_rate_limit", {
    _api_key_id: legacy.key_id,
    _limit: API_RATE_LIMIT_PER_HOUR,
  });
  if (!rlErr) noteRateLimitSuccess();
  const { data: meta } = await supabase
    .from("api_keys")
    .select("prefix, organization_id")
    .eq("id", legacy.key_id)
    .maybeSingle();
  return {
    key_id: legacy.key_id,
    user_id: legacy.user_id,
    scopes: legacy.scopes ?? [],
    prefix: meta?.prefix ?? null,
    organization_id: meta?.organization_id ?? null,
    rateLimit: rl,
  };
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
  let supabaseForLog: SupabaseApiClient | null = null;

  const respond = async (body: unknown, status = 200, errorMessage?: string, extraHeaders: Record<string, string> = {}) => {
    const res = new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
    });
    try {
      const client = supabaseForLog ?? createAdminClient();
      const logged = client.from("api_request_logs").insert({
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
      })
        // O log nunca pode atrasar a resposta: sai do caminho critico.
        .then(() => {}, () => {});
      const edgeRuntime = (globalThis as {
        EdgeRuntime?: { waitUntil?: (promise: PromiseLike<unknown>) => void };
      }).EdgeRuntime;
      if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(logged);
      else await logged;
    } catch (_) {
      // Never let logging break the response
    }
    return res;
  };

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return await respond({ error: "Missing X-API-Key header" }, 401);

    const supabase = createAdminClient();
    supabaseForLog = supabase;

    // Path is something like /public-api/companies/:id — strip the function prefix
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIdx = parts.indexOf("public-api");
    const segs = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
    const [resource, id] = segs;

    // GET /me e GET /events fecham em UM round-trip: a RPC autentica e devolve o
    // dado no mesmo statement (public_api_me / public_api_events). Antes, todo
    // request pagava dois: a auth e a leitura. Medido pelo pg_net (de dentro do
    // Supabase, 24/11/2026): /events p50 287 ms e /companies p50 284 ms - o piso de
    // dois round-trips de ~140 ms - contra 356 ms de /me, que ainda abria DUAS
    // conexoes em paralelo (o Promise.all custa dois handshakes, nao um).
    // authenticate_api_key continua sendo a unica autoridade de 401/429 e de quota;
    // aqui so repassamos o status que ela devolveu.
    const keyHash = await sha256Hex(apiKey);


    // Resposta de recusa comum as RPCs de um round-trip: devolve a Response
    // quando a credencial nao passou, ou null quando o status e 200 e quem
    // chamou monta o corpo de sucesso.
    const oneRoundTripRejection = async (b: OneRoundTripResult): Promise<Response | null> => {
      if (b.status === 401) return await respond({ error: "Invalid or expired API key" }, 401);
      if (b.status === 429) {
        return await respond(
          {
            error: "Rate limit exceeded. Retry after the current window resets.",
            current_count: b.current_count ?? null,
            reset_at: b.reset_at ?? null,
          },
          429,
          undefined,
          { "Retry-After": retryAfterSeconds(b.reset_at ?? null) },
        );
      }
      if (b.status === 404) return await respond({ error: "API key not found" }, 404);
      if (b.status !== 200) return await respond({ error: "Authentication failed" }, 500);
      return null;
    };

    if (resource === "me" || resource === "events") {
      const { data: boot, error: bootErr } = await supabase.rpc(
        resource === "me" ? "public_api_me" : "public_api_events",
        resource === "me" ? { _key_hash: keyHash } : {
          _key_hash: keyHash,
          _limit: Math.min(100, parseInt(url.searchParams.get("limit") ?? "25") || 25),
          _after: url.searchParams.get("after") || null,
          _table_name: url.searchParams.get("table") || null,
          _action: url.searchParams.get("action") || null,
        },
      );
      if (bootErr) return await respond({ error: bootErr.message }, 500);
      const b = (boot ?? {}) as OneRoundTripResult;
      const rejected = await oneRoundTripRejection(b);
      if (rejected) return rejected;

      // So depois da credencial validada, como antes, o metodo errado vira 405.
      if (req.method !== "GET") return await respond({ error: "Method not allowed" }, 405);

      logCtx.api_key_id = b.key_id ?? null;
      logCtx.user_id = b.user_id ?? null;
      logCtx.api_key_prefix = b.prefix ?? null;
      logCtx.organization_id = b.organization_id ?? null;
      logCtx.resource = resource;

      if (resource === "me") {
        // A ordem das chaves e montada aqui: jsonb nao preserva a ordem de insercao.
        const k = (b.key ?? {}) as Record<string, unknown>;
        return await respond({
          data: {
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            scopes: k.scopes,
            active: k.active,
            expires_at: k.expires_at,
            last_used_at: k.last_used_at,
            created_at: k.created_at,
            organization_id: k.organization_id,
            user_id: b.user_id,
          },
        });
      }

      return await respond({
        data: ((b.events ?? []) as Array<Record<string, unknown>>).map((e) => ({
          id: e.id,
          action: e.action,
          table: e.table,
          record_id: e.record_id,
          payload: e.payload,
          metadata: e.metadata,
          occurred_at: e.occurred_at,
        })),
        next_cursor: b.next_cursor ?? null,
      });
    }

    // GET lista (companies/deals/stakeholders) tambem fecha em UM round-trip
    // (RPC public_api_list). Os limites usam a MESMA expressao do caminho
    // historico logo abaixo - min(Number(limit ?? 50), 200) e max(Number(offset
    // ?? 0), 0) - e este caminho so vale para inteiro valido: entrada estranha
    // (?limit=abc, ?limit=0, ?limit=-5) cai no caminho antigo, para nao trocar o
    // que o header Range do PostgREST fazia.
    if (req.method === "GET" && !id && resource && ALLOWED_TABLES.includes(resource as AllowedTable)) {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      if (Number.isInteger(limit) && limit >= 1 && Number.isInteger(offset)) {
        const { data: listBoot, error: listErr } = await supabase.rpc("public_api_list", {
          _key_hash: keyHash,
          _table_name: resource,
          _limit: limit,
          _offset: offset,
          _name: url.searchParams.get("name") || null,
          _sector: url.searchParams.get("sector") || null,
        });
        if (listErr) return await respond({ error: listErr.message }, 500);

        const b = (listBoot ?? {}) as OneRoundTripResult;
        const rejected = await oneRoundTripRejection(b);
        if (rejected) return rejected;

        logCtx.api_key_id = b.key_id ?? null;
        logCtx.user_id = b.user_id ?? null;
        logCtx.api_key_prefix = b.prefix ?? null;
        logCtx.organization_id = b.organization_id ?? null;
        logCtx.resource = resource;

        return await respond({ data: b.items ?? [], total: b.total ?? null, limit, offset });
      }
    }

    let auth: ApiKeyAuth | null;
    try {
      auth = await authenticateApiKey(supabase, keyHash);
    } catch (e) {
      if (!(e instanceof RateLimitUnavailableError)) throw e;
      // Etapa 038: falha de infraestrutura nao e chave invalida (401). O
      // cliente precisa saber que pode tentar de novo.
      return await respond(
        { error: "Rate limit service unavailable. Retry shortly." },
        503,
        "rate_limit_unavailable",
        { "Retry-After": "5" },
      );
    }
    if (!auth) return await respond({ error: "Invalid or expired API key" }, 401);
    const { user_id, scopes, key_id } = auth;

    // Rate limit server-side por API key (janela fixa de 1h, RPC atômica)
    const rlDecision = parseRateLimitDecision(auth.rateLimit);
    if (rlDecision.available) {
      noteRateLimitSuccess();
    } else if (!withinFailOpenTolerance()) {
      // Etapa 038: sem decisao de quota e sem contagem bem-sucedida nos ultimos
      // 60 s, servir a resposta seria servir sem teto — uma integracao em laco
      // derruba o banco de todos os clientes.
      return await respond(
        { error: "Rate limit service unavailable. Retry shortly." },
        503,
        "rate_limit_unavailable",
        { "Retry-After": "5" },
      );
    }
    if (rlDecision.available && !rlDecision.allowed) {
      return await respond(
        {
          error: "Rate limit exceeded. Retry after the current window resets.",
          current_count: rlDecision.currentCount,
          reset_at: rlDecision.resetAt,
        },
        429,
        undefined,
        { "Retry-After": retryAfterSeconds(rlDecision.resetAt) },
      );
    }
    logCtx.api_key_id = key_id;
    logCtx.user_id = user_id;
    logCtx.api_key_prefix = auth.prefix;
    logCtx.organization_id = auth.organization_id;

    logCtx.resource = resource ?? null;

    if (!resource) return await respond({ error: "Resource required (me|companies|deals|stakeholders|events)" }, 400);

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

      // O que esta na lixeira nao volta pela API, igual ao app (ADR-008).
      if (SOFT_DELETE_TABLES.includes(table)) query = query.is("deleted_at", null);

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
      let single = supabase.from(table).select("*").eq("user_id", user_id).eq("id", id);
      if (SOFT_DELETE_TABLES.includes(table)) single = single.is("deleted_at", null);
      const { data, error } = await single.maybeSingle();
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
      let updateQ = supabase.from(table).update(patch).eq("user_id", user_id).eq("id", id);
      if (SOFT_DELETE_TABLES.includes(table)) updateQ = updateQ.is("deleted_at", null);
      const { data, error } = await updateQ.select().single();
      if (error) return await respond({ error: error.message }, 400);
      return await respond({ data });
    }

    // DELETE
    if (req.method === "DELETE" && id) {
      // Lixeira em vez de exclusao fisica (ADR-008): o registro fica 30 dias
      // recuperavel e some da API, exatamente como `workflow-engine:944` e o
      // `withOrg` do front fazem. Sem a coluna nao ha lixeira, entao a rota e'
      // recusada em vez de apagar em definitivo.
      if (!SOFT_DELETE_TABLES.includes(table)) {
        return await respond({ error: "Resource does not support deletion" }, 405);
      }
      const { data, error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) return await respond({ error: error.message }, 400);
      if (!data) return await respond({ error: "Not found" }, 404);
      return await respond({ success: true });
    }

    return await respond({ error: "Method/route not supported" }, 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await respond({ error: msg }, 500);
  }
});
