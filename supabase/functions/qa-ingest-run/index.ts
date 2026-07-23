// Edge Function: qa-ingest-run
// Recebe payloads do CI com resultado de suites (unit/edge/e2e) e grava em qa_test_runs.
// Autenticação via header x-qa-token (segredo QA_INGEST_TOKEN).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("QA_INGEST_TOKEN");
  if (!expected) return badRequest("QA_INGEST_TOKEN not configured on server");
  const provided = req.headers.get("x-qa-token");
  if (!provided || provided !== expected) return unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("invalid json"); }

  const runs: unknown[] = Array.isArray(body) ? body : [body];
  const invalid: number[] = [];
  runs.forEach((r, i) => { if (!validate(r)) invalid.push(i); });
  if (invalid.length > 0) return badRequest("invalid payload", { invalidIndexes: invalid });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return badRequest("supabase env missing");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

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
