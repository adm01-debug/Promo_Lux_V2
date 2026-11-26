/**
 * mcp-query — Gateway MCP para SUPABASE PROMO LUX V2
 * Suporta: sql/sql_b64 (somente leitura) e admin (proxy restrito de storage/auth)
 *
 * Autenticacao (etapa 026 do plano de QA):
 *   1. sessao de usuario com papel `admin` em alguma organizacao; ou
 *   2. credencial de servico valida (isCronAuthorized, comparacao de tempo constante).
 * O header `x-mcp-secret` deixou de ser gate unico: e um texto fixo, sem expiracao
 * e sem vinculo com usuario — vazado, dava SQL livre com a chave mestra.
 *
 * Deploy: supabase functions deploy mcp-query --project-ref pttzwlbidamibjssqiqb
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isCronAuthorized, timingSafeEqual } from "../_shared/cron-auth.ts";

const SECRET = Deno.env.get("MCP_SECRET");
const CORS_ORIGINS = (Deno.env.get("MCP_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const IS_SELECT = /^\s*(SELECT|WITH)\b/i;

/**
 * Etapa 028: lista explicita de rotas do modo admin. Nenhum arquivo de `src/`
 * usa este canal, entao a lista fica restrita as listagens de storage. Qualquer
 * rota fora dela responde 403 — inclusive `auth/v1/admin/users`, que mesmo em
 * GET expos a base de usuarios.
 */
const ADMIN_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^storage\/v1\/bucket$/ },
  { method: "POST", pattern: /^storage\/v1\/object\/list\/[A-Za-z0-9._-]+$/ },
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  if (!origin || !CORS_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-mcp-secret, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function decodeB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

type Gate =
  | { ok: true; via: "admin_session" | "service_key"; userId?: string }
  | { ok: false; status: number; reason: string };

async function authorize(
  req: Request,
  url: string,
  key: string,
): Promise<Gate> {
  if (isCronAuthorized(req)) return { ok: true, via: "service_key" };

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer "))
    return { ok: false, status: 401, reason: "missing_credentials" };

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey)
    return { ok: false, status: 500, reason: "server_misconfigured" };

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user)
    return { ok: false, status: 401, reason: "invalid_jwt" };

  const admin = createClient(url, key);
  const { data: rows } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .limit(1);

  if (!rows || rows.length === 0) {
    return { ok: false, status: 403, reason: "admin_role_required" };
  }
  return { ok: true, via: "admin_session", userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST")
    return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key) return json(req, { error: "server_misconfigured" }, 500);

  const gate = await authorize(req, url, key);
  if (!gate.ok) {
    // O segredo continua aceito como CAMADA ADICIONAL (segundo fator), nunca sozinho.
    const presented = req.headers.get("x-mcp-secret") ?? "";
    const hasSecret = !!SECRET && timingSafeEqual(presented, SECRET);
    const reason = hasSecret
      ? `${gate.reason}__service_credential_required`
      : gate.reason;
    console.warn("mcp_query_denied", { reason, via: "denied" });
    return json(req, { error: "unauthorized", reason }, gate.status);
  }

  let body: {
    sql?: string;
    sql_b64?: string;
    limit?: number;
    allow_all_rows?: boolean;
    admin?: { path: string; method?: string; body?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid json" }, 400);
  }

  // ── Modo admin (proxy restrito de storage) ──────────────────────────────────
  if (body.admin) {
    const { path, method = "GET", body: adminBody } = body.admin;
    const verb = method.toUpperCase();
    const allowed = ADMIN_ROUTES.find(
      (r) => r.method === verb && r.pattern.test(path ?? ""),
    );
    if (!allowed) {
      return json(
        req,
        {
          error: "route_not_allowed",
          detail: "rota fora da lista explicita do modo admin (etapa 028)",
          allowed: ADMIN_ROUTES.map((r) => `${r.method} ${r.pattern.source}`),
        },
        403,
      );
    }

    const res = await fetch(`${url}/${path}`, {
      method: verb,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: adminBody === undefined ? undefined : JSON.stringify(adminBody),
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return json(req, { status: res.status, ok: res.ok, data });
  }

  // ── Modo SQL (somente leitura) ──────────────────────────────────────────────
  let sql = body.sql ?? "";
  if (body.sql_b64) {
    try {
      sql = decodeB64(body.sql_b64);
    } catch {
      return json(req, { error: "sql_b64 invalido" }, 400);
    }
  }
  sql = sql.trim();
  if (!sql) return json(req, { error: "empty sql" }, 400);
  if (!IS_SELECT.test(sql))
    return json(
      req,
      { error: "Apenas SELECT e WITH sao aceitos (canal somente leitura)" },
      400,
    );

  const limit = Number(body.limit) || 100;
  const finalSql =
    IS_SELECT.test(sql) && !/\blimit\b/i.test(sql)
      ? `${sql} LIMIT ${limit}`
      : sql;

  const res = await fetch(`${url}/rest/v1/rpc/mcp_query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ _sql: finalSql }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok)
    return json(req, { error: data ?? { http: res.status } }, res.status);

  const rows = Array.isArray(data) ? data : [data];
  return json(req, { rows, count: rows.length, via: gate.via });
});
