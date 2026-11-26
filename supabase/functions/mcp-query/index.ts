/**
 * mcp-query — Gateway MCP para SUPABASE PROMO LUX V2
 * Suporta: sql, sql_b64, admin (storage/auth proxy)
 * Autenticação: x-mcp-secret header
 * Deploy: supabase functions deploy mcp-query --project-ref pttzwlbidamibjssqiqb --no-verify-jwt
 */

const SECRET = Deno.env.get("MCP_SECRET");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-mcp-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IS_SELECT   = /^\s*(SELECT|WITH)\b/i;

function decodeB64(b64: string): string {
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!SECRET) return json({ error: "server_misconfigured" }, 500);
  if (req.headers.get("x-mcp-secret") !== SECRET) return json({ error: "unauthorized" }, 401);

  let body: { sql?: string; sql_b64?: string; limit?: number; allow_all_rows?: boolean; admin?: { path: string; method?: string; body?: unknown } };
  try { body = await req.json(); }
  catch { return json({ error: "invalid json" }, 400); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key) return json({ error: "server_misconfigured" }, 500);

  // ── Modo admin (proxy storage/auth) ─────────────────────────────────────────
  if (body.admin) {
    const { path, method = "GET", body: adminBody } = body.admin;
    if (!path || !/^(storage|auth)\/v1\//.test(path)) {
      return json({ error: "admin.path deve começar com storage/v1/ ou auth/v1/" }, 400);
    }
    const res = await fetch(`${url}/${path}`, {
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "apikey": key,
      },
      body: adminBody === undefined ? undefined : JSON.stringify(adminBody),
    });
    let data: unknown;
    try { data = await res.json(); } catch { data = null; }
    return json({ status: res.status, ok: res.ok, data });
  }

  // ── Modo SQL ─────────────────────────────────────────────────────────────────
  let sql = body.sql ?? "";
  if (body.sql_b64) {
    try { sql = decodeB64(body.sql_b64); }
    catch { return json({ error: "sql_b64 inválido" }, 400); }
  }
  sql = sql.trim();
  if (!sql) return json({ error: "empty sql" }, 400);
  if (!IS_SELECT.test(sql)) return json({ error: "Apenas SELECT e WITH sao aceitos (canal somente leitura)" }, 400);

  const limit   = Number(body.limit) || 100;
  const finalSql = IS_SELECT.test(sql) && !/\blimit\b/i.test(sql) ? `${sql} LIMIT ${limit}` : sql;

  const res = await fetch(`${url}/rest/v1/rpc/mcp_query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify({ _sql: finalSql }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return json({ error: data ?? { http: res.status } }, res.status);

  const rows = Array.isArray(data) ? data : [data];
  return json({ rows, count: rows.length });
});
