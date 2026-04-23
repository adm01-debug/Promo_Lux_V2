/**
 * Fixtures utilitárias para os testes da função `rls-tests`.
 *
 * Cobrem dois cenários determinísticos:
 *   - `createNonAdminUserFixture`: usuário autenticado SEM nenhuma linha
 *     em `organization_members` com role='admin' — usado para validar
 *     que a rota responde 403.
 *   - `createAdminUserFixture`: usuário com uma org dedicada e linha
 *     em `organization_members` com role='admin' — usado para validar
 *     que a rota responde 200/422 com relatório.
 *
 * Ambas devolvem um `cleanup()` idempotente que remove o que criaram —
 * evitando lixo no banco mesmo se o teste falhar no meio.
 *
 * NÃO dependem do trigger `handle_new_organization`: a fixture admin
 * insere a linha em `organization_members` explicitamente. Isso protege
 * o suite contra regressões silenciosas no trigger e garante que o teste
 * 403 jamais vire um falso-positivo (ex.: se algum dia um trigger novo
 * passar a auto-vincular usuários a uma org default).
 */
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CLIENT_OPTS = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
} as const;

export interface FixtureContext {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
}

export interface UserFixture {
  userId: string;
  email: string;
  password: string;
  /** Token JWT válido para chamar edge functions como esse usuário. */
  accessToken: string;
  /** Cliente já autenticado (útil para chamadas adicionais). */
  userClient: SupabaseClient;
  /** Liberação total dos recursos criados. Idempotente. */
  cleanup: () => Promise<void>;
}

export interface AdminUserFixture extends UserFixture {
  organizationId: string;
  organizationSlug: string;
}

function makeIdSuffix(label: string): string {
  // Sufixo único e curto: timestamp + randômico — evita colisões entre
  // execuções paralelas do suite e mantém os emails legíveis nos logs.
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 6);
  return `${label}-${ts}-${rand}`;
}

/**
 * Cria usuário autenticado mas SEM membership em qualquer organização.
 * Em seguida faz uma sweep defensiva removendo qualquer linha que algum
 * trigger possa ter criado em `organization_members` para esse user_id —
 * garantindo o invariante "esse usuário NÃO é admin de nada" mesmo
 * frente a triggers futuros.
 */
export async function createNonAdminUserFixture(
  ctx: FixtureContext,
): Promise<UserFixture> {
  const admin = createClient(ctx.supabaseUrl, ctx.serviceKey, CLIENT_OPTS);
  const suffix = makeIdSuffix("rls-noadmin");
  const email = `${suffix}@test.local`;
  const password = "TestPass123!";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createNonAdminUserFixture: createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;

  // Defesa: zera memberships herdadas de triggers (idempotente).
  await admin.from("organization_members").delete().eq("user_id", userId);

  const userClient = createClient(ctx.supabaseUrl, ctx.anonKey, CLIENT_OPTS);
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.session) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`createNonAdminUserFixture: signIn failed: ${signErr?.message}`);
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try { await userClient.auth.signOut(); } catch { /* ignore */ }
    // Remove qualquer membership criada após o sign-in também (paranoia).
    await admin.from("organization_members").delete().eq("user_id", userId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  };

  return {
    userId,
    email,
    password,
    accessToken: signIn.session.access_token,
    userClient,
    cleanup,
  };
}

/**
 * Cria usuário + org dedicada + linha em `organization_members` com
 * role='admin', sem depender do trigger `handle_new_organization`. Se o
 * trigger já tiver inserido a linha, usamos `upsert` para manter a
 * operação idempotente.
 */
export async function createAdminUserFixture(
  ctx: FixtureContext,
): Promise<AdminUserFixture> {
  const admin = createClient(ctx.supabaseUrl, ctx.serviceKey, CLIENT_OPTS);
  const suffix = makeIdSuffix("rls-admin");
  const email = `${suffix}@test.local`;
  const password = "TestPass123!";
  const slug = `org-${suffix}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createAdminUserFixture: createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `RLS Admin Test ${suffix}`, slug, owner_id: userId })
    .select("id")
    .single();
  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`createAdminUserFixture: insert org failed: ${orgErr?.message}`);
  }
  const organizationId = org.id as string;

  // Idempotência: se um trigger já inseriu, garantimos role='admin'
  // sem violar o unique (organization_id, user_id).
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: organizationId, user_id: userId, role: "admin" },
      { onConflict: "organization_id,user_id" },
    );
  if (memberErr) {
    await admin.from("organizations").delete().eq("id", organizationId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`createAdminUserFixture: upsert member failed: ${memberErr.message}`);
  }

  // Verificação dura do invariante — falha cedo e barulhento se algo
  // (trigger, RLS) impedir a linha admin de existir.
  const { data: check, error: checkErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (checkErr || !check) {
    await admin.from("organization_members").delete().eq("organization_id", organizationId).catch(() => {});
    await admin.from("organizations").delete().eq("id", organizationId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(
      `createAdminUserFixture: linha admin não persistiu (${checkErr?.message ?? "row not found"})`,
    );
  }

  const userClient = createClient(ctx.supabaseUrl, ctx.anonKey, CLIENT_OPTS);
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.session) {
    await admin.from("organization_members").delete().eq("organization_id", organizationId).catch(() => {});
    await admin.from("organizations").delete().eq("id", organizationId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`createAdminUserFixture: signIn failed: ${signErr?.message}`);
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try { await userClient.auth.signOut(); } catch { /* ignore */ }
    // Ordem importa: members → org → user (FKs com CASCADE cobrem o
    // happy-path, mas executamos manualmente para tolerar configurações
    // sem cascade).
    await admin.from("organization_members").delete().eq("organization_id", organizationId).catch(() => {});
    await admin.from("organizations").delete().eq("id", organizationId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  };

  return {
    userId,
    email,
    password,
    accessToken: signIn.session.access_token,
    userClient,
    organizationId,
    organizationSlug: slug,
    cleanup,
  };
}