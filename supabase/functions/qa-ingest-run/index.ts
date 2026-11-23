// Edge Function: qa-ingest-run
// Recebe payloads do CI com resultado de suites (unit/edge/e2e) e grava em qa_test_runs.
// Autenticação via header x-qa-token: aceita o segredo de plataforma QA_INGEST_TOKEN
// (quando existir) ou um token ativo em public.qa_ingest_tokens — só o hash SHA-256
// fica no banco, porque a Management API do Supabase não permite gravar segredos aqui.
// Administração dos tokens: header x-qa-action (rotate|list|revoke) com JWT de admin.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { timingSafeEqual } from "../_shared/cron-auth.ts";

interface RunPayload {
  round?: number | null;
  kind: "unit" | "edge" | "e2e" | "integration" | "lint" | "typecheck";
  suite?: string | null;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped?: number;
  duration_ms: number;
  coverage_pct?: number | null;
  commit_sha?: string | null;
  branch?: string | null;
  metadata?: Record<string, unknown>;
}

function badRequest(msg: string, extra?: unknown) {
  return new Response(JSON.stringify({ error: msg, details: extra ?? null }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validate(p: unknown): p is RunPayload {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  const kinds = ["unit", "edge", "e2e", "integration", "lint", "typecheck"];
  if (typeof r.kind !== "string" || !kinds.includes(r.kind)) return false;
  const nums = ["tests_total", "tests_passed", "tests_failed", "duration_ms"];
  for (const k of nums) {
    if (typeof r[k] !== "number" || !Number.isFinite(r[k] as number) || (r[k] as number) < 0) return false;
  }
  if (r.tests_skipped !== undefined && typeof r.tests_skipped !== "number") return false;
  if (r.coverage_pct !== undefined && r.coverage_pct !== null) {
    const c = r.coverage_pct as number;
    if (typeof c !== "number" || c < 0 || c > 100) return false;
  }
  return true;
}

// supabase/functions não usa os tipos gerados em src/integrations/supabase/types.ts
// (ele nem lista qa_test_runs/qa_ingest_tokens), então o client fica sem schema fixo.
type SbClient = SupabaseClient<any, "public", any>;

const QA_ACTIONS = ["rotate", "list", "revoke"] as const;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** SHA-256 em hex minúsculo — mesmo formato de `encode(sha256(x::bytea),'hex')`. */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Aceita um token ativo gravado no banco e registra o uso. */
async function acceptDbToken(supabase: SbClient, provided: string): Promise<boolean> {
  const tokenHash = await sha256Hex(provided);
  const { data, error } = await supabase
    .from("qa_ingest_tokens")
    .select("id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    console.error("qa-ingest-run token lookup failed:", error);
    return false;
  }
  if (!data) return false;
  await supabase
    .from("qa_ingest_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

/**
 * Administração dos tokens de ingestão (rotate/list/revoke).
 * Exige JWT válido + papel `admin` em public.user_roles — a mesma fonte de verdade
 * de `public.has_role(_user_id,'admin')` usado pelas policies de RLS.
 */
async function handleTokenAdmin(action: string, req: Request, supabase: SbClient): Promise<Response> {
  if (!(QA_ACTIONS as readonly string[]).includes(action)) {
    return badRequest(`invalid x-qa-action (use: ${QA_ACTIONS.join(", ")})`);
  }
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return unauthorized();

  const { data: auth, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return unauthorized();

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !roleRow) return unauthorized();

  if (action === "list") {
    const { data, error } = await supabase
      .from("qa_ingest_tokens")
      .select("id, label, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return jsonResponse({ error: "list_failed", details: error.message }, 500);
    return jsonResponse({ ok: true, tokens: data ?? [] });
  }

  if (action === "rotate") {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await supabase.from("qa_ingest_tokens").insert({
      label: "CI",
      token_hash: await sha256Hex(token),
      created_by: auth.user.id,
    });
    if (error) return jsonResponse({ error: "insert_failed", details: error.message }, 500);
    // Devolvido em texto claro uma única vez; o banco guarda apenas o hash.
    return jsonResponse({ ok: true, token });
  }

  const payload = (await req.json().catch(() => ({}))) as { id?: string };
  let query = supabase
    .from("qa_ingest_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .is("revoked_at", null);
  if (typeof payload.id === "string" && payload.id) query = query.eq("id", payload.id);
  const { data, error } = await query.select("id");
  if (error) return jsonResponse({ error: "revoke_failed", details: error.message }, 500);
  return jsonResponse({ ok: true, revoked: data?.length ?? 0 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return badRequest("supabase env missing");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  }) as SbClient;

  const action = req.headers.get("x-qa-action");
  if (action) return await handleTokenAdmin(action, req, supabase);

  const provided = req.headers.get("x-qa-token");
  if (!provided) return unauthorized();

  const expected = Deno.env.get("QA_INGEST_TOKEN");
  const authorized = !!expected && timingSafeEqual(provided, expected)
    ? true
    : await acceptDbToken(supabase, provided);
  if (!authorized) return unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("invalid json"); }

  const runs: unknown[] = Array.isArray(body) ? body : [body];
  const invalid: number[] = [];
  runs.forEach((r, i) => { if (!validate(r)) invalid.push(i); });
  if (invalid.length > 0) return badRequest("invalid payload", { invalidIndexes: invalid });

  const rows = (runs as RunPayload[]).map((r) => ({
    round: r.round ?? null,
    kind: r.kind,
    suite: r.suite ?? null,
    tests_total: r.tests_total,
    tests_passed: r.tests_passed,
    tests_failed: r.tests_failed,
    tests_skipped: r.tests_skipped ?? 0,
    duration_ms: r.duration_ms,
    coverage_pct: r.coverage_pct ?? null,
    commit_sha: r.commit_sha ?? null,
    branch: r.branch ?? null,
    metadata: r.metadata ?? {},
  }));

  const { data, error } = await supabase.from("qa_test_runs").insert(rows).select("id");
  if (error) {
    console.error("qa-ingest-run insert failed:", error);
    return new Response(JSON.stringify({ error: "insert_failed", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, inserted: data?.length ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
