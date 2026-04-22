// Public REST API authenticated via X-API-Key header
// Endpoints:
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Missing X-API-Key header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRows, error: keyErr } = await supabase.rpc("verify_api_key", { _key_hash: keyHash });
    if (keyErr || !keyRows?.length) return json({ error: "Invalid or expired API key" }, 401);
    const { user_id, scopes, key_id } = keyRows[0];
    await supabase.rpc("touch_api_key", { _key_id: key_id });

    const url = new URL(req.url);
    // Path is something like /public-api/companies/:id — strip the function prefix
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIdx = parts.indexOf("public-api");
    const segs = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
    const [resource, id] = segs;

    if (!resource) return json({ error: "Resource required (companies|deals|stakeholders)" }, 400);
    if (!ALLOWED_TABLES.includes(resource as AllowedTable)) {
      return json({ error: "Unknown resource" }, 404);
    }
    const table = resource as AllowedTable;

    const isWrite = ["POST", "PATCH", "DELETE"].includes(req.method);
    if (isWrite && !scopes.includes("write")) {
      return json({ error: "API key lacks 'write' scope" }, 403);
    }

    // GET list
    if (req.method === "GET" && !id) {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .eq("user_id", user_id)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data, total: count, limit, offset });
    }

    // GET single
    if (req.method === "GET" && id) {
      const { data, error } = await supabase
        .from(table).select("*").eq("user_id", user_id).eq("id", id).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }

    // POST create
    if (req.method === "POST" && !id) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
      const insert = { ...body, user_id };
      const { data, error } = await supabase.from(table).insert(insert).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }

    // PATCH update
    if (req.method === "PATCH" && id) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
      delete (body as Record<string, unknown>).user_id;
      delete (body as Record<string, unknown>).id;
      const { data, error } = await supabase
        .from(table).update(body).eq("user_id", user_id).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // DELETE
    if (req.method === "DELETE" && id) {
      const { error } = await supabase.from(table).delete().eq("user_id", user_id).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Method/route not supported" }, 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});