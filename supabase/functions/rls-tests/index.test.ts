/**
 * Testes da função `rls-tests`.
 *
 * Garante que a rota é protegida por:
 *   1. JWT obrigatório (401 sem Bearer) — equivalente a `verify_jwt = true`.
 *      Se alguém desabilitar `verify_jwt` por engano, o guard em código
 *      ainda rejeita a chamada — defesa em profundidade.
 *   2. Papel de admin obrigatório (403 com JWT válido mas sem role admin).
 *   3. Sucesso (200/422 com relatório estruturado) quando admin chama.
 *
 * Carrega credenciais via `dotenv/load.ts` lendo `.env` da raiz.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/rls-tests`;

function corsAndJson(extra: Record<string, string> = {}) {
  return {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
    Origin: "https://lux-ai-company-finder.lovable.app",
    ...extra,
  };
}

Deno.test("rls-tests: rejeita 401 quando NÃO há Authorization Bearer", async () => {
  const res = await fetch(FUNCTION_URL, { method: "POST", headers: corsAndJson() });
  const body = await res.json();
  assertEquals(res.status, 401, `expected 401, got ${res.status}`);
  assertEquals(body.error, "Unauthorized");
  assertEquals(body.reason, "missing_bearer_token");
});

Deno.test("rls-tests: rejeita 401 com Bearer inválido (JWT corrompido)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: corsAndJson({ Authorization: "Bearer not-a-real-jwt.xxx.yyy" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Unauthorized");
  assert(
    body.reason === "invalid_jwt" || body.reason === "missing_bearer_token",
    `unexpected reason: ${body.reason}`,
  );
});

Deno.test("rls-tests: retorna 403 quando JWT é válido mas user não é admin", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — pulando teste de role.");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const email = `rls-test-noadmin-${Date.now()}@test.local`;
  const password = "TestPass123!";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(createErr?.message ?? "create user failed");
  const userId = created.user.id;

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signIn.session) throw new Error(signErr?.message ?? "sign in failed");

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: corsAndJson({ Authorization: `Bearer ${signIn.session.access_token}` }),
    });
    const body = await res.json();
    assertEquals(res.status, 403, `expected 403, got ${res.status}: ${JSON.stringify(body)}`);
    assertEquals(body.error, "Forbidden");
    assertEquals(body.reason, "admin_role_required");
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});

Deno.test("rls-tests: retorna relatório estruturado para admin (200 ou 422)", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — pulando teste de admin.");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
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

  // Trigger handle_new_organization adiciona owner como admin.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: "RLS Admin Test", slug, owner_id: userId })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(orgErr?.message ?? "create org failed");

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !signIn.session) throw new Error(signErr?.message ?? "sign in failed");

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: corsAndJson({ Authorization: `Bearer ${signIn.session.access_token}` }),
    });
    const body = await res.json();
    assert(
      res.status === 200 || res.status === 422,
      `expected 200/422, got ${res.status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
    // Estrutura do relatório
    assert(typeof body.allPassed === "boolean", "missing allPassed flag");
    assert(typeof body.total === "number", "missing total count");
    assert(Array.isArray(body.results), "missing results array");
    assert(body.results.length > 0, "results should not be empty");
    for (const r of body.results) {
      assert(typeof r.name === "string");
      assert(typeof r.passed === "boolean");
    }
  } finally {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
  }
});
