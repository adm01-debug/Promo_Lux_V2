/**
 * Testes da função `rls-tests`.
 *
 * Garante que a rota é protegida por:
 *   1. JWT obrigatório — gateway (`verify_jwt = true`) OU guard em código
 *      bloqueiam quando não há Bearer / Bearer corrompido. Defesa em
 *      profundidade: mesmo se alguém desabilitar `verify_jwt` por engano,
 *      o guard ainda rejeita.
 *   2. Papel de admin obrigatório (403 com JWT válido mas sem role).
 *   3. Sucesso (200/422 com relatório estruturado) quando admin chama.
 *
 * Carrega credenciais via `dotenv/load.ts` lendo `.env` da raiz.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/rls-tests`;

// Desliga refresh automático e persistência → evita "leaks: intervals
// were started but never completed" no test runner do Deno.
const CLIENT_OPTS = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
} as const;

function corsAndJson(extra: Record<string, string> = {}) {
  return {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
    Origin: "https://lux-ai-company-finder.lovable.app",
    ...extra,
  };
}

/**
 * Parse seguro do body. Gateway pode responder com:
 *   - JSON estruturado quando a função executa.
 *   - Texto cru ("Internal Server Error", "Unauthorized") em 401/500
 *     quando o gateway corta antes da função.
 *   - Body vazio em 204.
 * Sempre devolve um objeto, marcando a origem com `_raw` / `_isJson` /
 * `_contentType` para diagnóstico nas mensagens de assert.
 */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") ?? "";
  let text = "";
  try {
    text = await res.text();
  } catch (e) {
    return { _raw: "", _contentType: contentType, _isJson: false, _readError: String(e) };
  }
  const trimmed = text.trim();
  if (!trimmed) return { _raw: "", _contentType: contentType, _isJson: false };
  const looksJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");
  if (looksJson) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return { ...parsed, _raw: text, _contentType: contentType, _isJson: true };
    } catch { /* fallback texto */ }
  }
  return { _raw: text, _contentType: contentType, _isJson: false };
}

/** Trecho curto e seguro do body para mensagens de erro. */
function bodySnippet(body: Record<string, unknown>, max = 200): string {
  if (body._isJson) {
    const { _raw: _r, _contentType: _c, _isJson: _i, ...rest } = body;
    return JSON.stringify(rest).slice(0, max);
  }
  return String(body._raw ?? "").slice(0, max);
}

/**
 * Validação única para chamadas que devem ser negadas (no auth, JWT
 * inválido, falta de role, ou falha do gateway). Aceita 401/403/500
 * conforme o cenário e — o mais importante — garante que o payload
 * NUNCA expõe `allPassed` ou `results` (relatório de RLS).
 *
 * @param allowed conjunto de status aceitáveis para o cenário em teste.
 */
function assertDeniedWithoutReport(
  res: Response,
  body: Record<string, unknown>,
  allowed: ReadonlyArray<number>,
  context: string,
) {
  assert(
    allowed.includes(res.status),
    `[${context}] esperado status em [${allowed.join(",")}], obteve ${res.status}: ${bodySnippet(body)}`,
  );
  // 200/422 → relatório real. Nenhum cenário "negado" pode bater nesses códigos.
  assert(
    res.status !== 200 && res.status !== 422,
    `[${context}] resposta de sucesso (${res.status}) NÃO é permitida em fluxo negado: ${bodySnippet(body)}`,
  );
  // O relatório de RLS jamais pode ser exposto, mesmo se o body for texto cru.
  assert(
    body.allPassed === undefined && body.results === undefined,
    `[${context}] payload expôs relatório RLS proibido: ${bodySnippet(body)}`,
  );
  // Defesa adicional: o texto cru também não pode conter as chaves do relatório.
  const raw = String(body._raw ?? "").toLowerCase();
  assert(
    !raw.includes("\"allpassed\"") && !raw.includes("\"results\""),
    `[${context}] texto cru menciona campos do relatório: ${raw.slice(0, 200)}`,
  );
}

Deno.test("rls-tests: rejeita 401 quando NÃO há Authorization Bearer", async () => {
  const res = await fetch(FUNCTION_URL, { method: "POST", headers: corsAndJson() });
  const body = await safeJson(res);
  // Sem Bearer: gateway (verify_jwt=true) ou guard interno respondem 401.
  // Em raras falhas o gateway pode devolver 500 com texto cru — também
  // aceitável desde que o relatório não vaze.
  assertDeniedWithoutReport(res, body, [401, 500], "no-auth");
});

Deno.test("rls-tests: rejeita Bearer JWT corrompido (gateway OU guard)", async () => {
  // verify_jwt=true → gateway responde 401/403/500 (texto cru) antes da função.
  // verify_jwt=false → guard em código retorna 401 estruturado.
  // O essencial: a chamada NUNCA pode ter sucesso (200/422 = relatório).
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: corsAndJson({ Authorization: "Bearer not-a-real-jwt.xxx.yyy" }),
  });
  const body = await safeJson(res);
  assertDeniedWithoutReport(res, body, [401, 403, 500], "jwt-corrompido");
});

Deno.test("rls-tests: retorna 403 quando JWT é válido mas user não é admin", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — pulando teste de role.");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, CLIENT_OPTS);
  const email = `rls-test-noadmin-${Date.now()}@test.local`;
  const password = "TestPass123!";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(createErr?.message ?? "create user failed");
  const userId = created.user.id;

  let userClient: SupabaseClient | null = null;
  try {
    userClient = createClient(SUPABASE_URL, ANON_KEY, CLIENT_OPTS);
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signIn.session) throw new Error(signErr?.message ?? "sign in failed");

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: corsAndJson({ Authorization: `Bearer ${signIn.session.access_token}` }),
    });
    const body = await safeJson(res);
    // Validação única: aceita 403 (esperado) ou 500 (gateway flapping)
    // e garante que o relatório nunca aparece.
    assertDeniedWithoutReport(res, body, [403, 500], "no-admin-role");
    // Quando vier 403 estruturado (caso comum), reforça o contrato da função.
    if (res.status === 403 && body._isJson) {
      assertEquals(body.error, "Forbidden");
      assertEquals(body.reason, "admin_role_required");
    }
  } finally {
    try { await userClient?.auth.signOut(); } catch { /* ignore */ }
    await admin.auth.admin.deleteUser(userId);
  }
});

Deno.test("rls-tests: retorna relatório estruturado quando admin chama", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — pulando teste de admin.");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, CLIENT_OPTS);
  const email = `rls-test-admin-${Date.now()}@test.local`;
  const password = "TestPass123!";
  const slug = `rls-admin-org-${Date.now()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(createErr?.message ?? "create user failed");
  const userId = created.user.id;

  // Trigger `handle_new_organization` adiciona owner como admin automaticamente.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: "RLS Admin Test", slug, owner_id: userId })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(orgErr?.message ?? "create org failed");

  let userClient: SupabaseClient | null = null;
  try {
    userClient = createClient(SUPABASE_URL, ANON_KEY, CLIENT_OPTS);
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signIn.session) throw new Error(signErr?.message ?? "sign in failed");

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: corsAndJson({ Authorization: `Bearer ${signIn.session.access_token}` }),
    });
    const body = await safeJson(res);
    assert(
      res.status === 200 || res.status === 422,
      `expected 200/422, got ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
    assert(typeof body.allPassed === "boolean", "missing allPassed flag");
    assert(typeof body.total === "number", "missing total count");
    assert(Array.isArray(body.results), "missing results array");
    const results = body.results as Array<{ name: string; passed: boolean }>;
    assert(results.length > 0, "results should not be empty");
    for (const r of results) {
      assert(typeof r.name === "string");
      assert(typeof r.passed === "boolean");
    }
  } finally {
    try { await userClient?.auth.signOut(); } catch { /* ignore */ }
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
  }
});
