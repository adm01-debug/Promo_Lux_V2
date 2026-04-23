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
 * Parse seguro do body. O gateway pode responder com:
 *   - JSON estruturado (caso comum: função executou).
 *   - Texto cru curto ("Internal Server Error", "Unauthorized") em 401/500
 *     quando o gateway corta antes da função.
 *   - Body vazio (raro, mas possível em 204).
 * Sempre devolvemos um objeto com:
 *   - campos JSON quando aplicável;
 *   - `_raw`: string original (vazia se body vazio);
 *   - `_contentType`: header bruto, útil para diagnóstico em asserts;
 *   - `_isJson`: boolean indicando parse bem-sucedido.
 * Nunca lança — é um helper defensivo de teste.
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
  if (!trimmed) {
    return { _raw: "", _contentType: contentType, _isJson: false };
  }
  // Só tenta JSON quando o servidor sinaliza ou o corpo começa com { / [.
  const looksJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");
  if (looksJson) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return { ...parsed, _raw: text, _contentType: contentType, _isJson: true };
    } catch {
      // Cai pro fallback de texto.
    }
  }
  return { _raw: text, _contentType: contentType, _isJson: false };
}

/**
 * Trecho curto e seguro do body para mensagens de erro de assert
 * (evita despejar 5KB de HTML de erro do gateway no relatório).
 */
function bodySnippet(body: Record<string, unknown>, max = 200): string {
  if (body._isJson) return JSON.stringify(body).slice(0, max);
  const raw = String(body._raw ?? "");
  return raw.slice(0, max);
}

Deno.test("rls-tests: rejeita 401 quando NÃO há Authorization Bearer", async () => {
  const res = await fetch(FUNCTION_URL, { method: "POST", headers: corsAndJson() });
  const body = await safeJson(res);
  // Gateway (verify_jwt=true) responde 401 antes de bater na função.
  // Se chegou na função, o guard responde 401 com payload estruturado.
  // Em ambos os casos: nunca deve devolver 200/422 (relatório).
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${bodySnippet(body)}`);
  // Mesmo se o gateway respondeu texto cru, garanta que NÃO há relatório.
  assert(
    body.allPassed === undefined && body.results === undefined,
    `401 não pode expor relatório: ${bodySnippet(body)}`,
  );
});

Deno.test("rls-tests: rejeita Bearer JWT corrompido (gateway OU guard)", async () => {
  // verify_jwt=true → gateway responde 401/500 com body texto antes de
  // a função executar (comportamento varia por versão do gateway).
  // verify_jwt=false → guard em código retorna 401 estruturado.
  // O essencial: a chamada NUNCA deve ter sucesso (200/422 = relatório).
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: corsAndJson({ Authorization: "Bearer not-a-real-jwt.xxx.yyy" }),
  });
  const body = await safeJson(res);
  assert(
    res.status >= 400 && res.status < 600 && res.status !== 422,
    `expected error status (≠200/422), got ${res.status}: ${bodySnippet(body)}`,
  );
  // Garante que o relatório real (allPassed/results) NUNCA é exposto.
  assert(
    body.allPassed === undefined && body.results === undefined,
    `JWT inválido NÃO pode retornar relatório RLS: ${bodySnippet(body)}`,
  );
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
    assertEquals(res.status, 403, `expected 403, got ${res.status}: ${bodySnippet(body)}`);
    // Se o gateway/função caírem com 500 e devolverem "Internal Server Error"
    // como texto, queremos falhar AQUI com mensagem clara em vez de comparar
    // `undefined === "Forbidden"`.
    assert(
      body._isJson,
      `403 deveria vir com JSON estruturado, recebeu ${body._contentType}: ${bodySnippet(body)}`,
    );
    assertEquals(body.error, "Forbidden");
    assertEquals(body.reason, "admin_role_required");
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
      `expected 200/422, got ${res.status}: ${bodySnippet(body, 300)}`,
    );
    // Diferencia claramente "função retornou texto cru de erro" de
    // "JSON sem o campo esperado" — facilita debug em CI.
    assert(
      body._isJson,
      `relatório deveria vir como JSON, recebeu ${body._contentType}: ${bodySnippet(body, 300)}`,
    );
    assert(typeof body.allPassed === "boolean", `missing allPassed flag: ${bodySnippet(body)}`);
    assert(typeof body.total === "number", `missing total count: ${bodySnippet(body)}`);
    assert(Array.isArray(body.results), `missing results array: ${bodySnippet(body)}`);
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
