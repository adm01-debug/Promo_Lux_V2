import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { RLS_TABLES, RLS_TABLES_EXEMPT, ENV_EXEMPT_TABLES, type AppEnv } from "../_shared/rlsTableRegistry.ts";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://id-preview--5ca97528-7ced-45bf-b83a-48ae8b7f46fc.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

// ── Structured Logger ──
function createLogger(requestId: string) {
  const base = { function: "rls-tests", request_id: requestId };
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info", msg, ...data, ts: new Date().toISOString() })),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ ...base, level: "error", msg, ...data, ts: new Date().toISOString() })),
  };
}

function getAppEnv(supabaseUrl: string): AppEnv {
  const envSecret = Deno.env.get("APP_ENV") as AppEnv | undefined;
  if (envSecret && ["dev", "staging", "prod"].includes(envSecret)) {
    return envSecret;
  }

  // Heurística baseada na URL
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) return "dev";
  if (supabaseUrl.includes("staging")) return "staging";
  
  // No Lovable Cloud, projetos de preview costumam ter IDs dinâmicos.
  // Se não for localhost nem explicitamente staging, tratamos como dev por segurança
  // a menos que o APP_ENV diga o contrário.
  return "dev"; 
}

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const log = createLogger(requestId);
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const start = performance.now();
  log.info("rls_test_start");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const currentEnv = getAppEnv(supabaseUrl);

  log.info("rls_test_config", { env: currentEnv });

  // ── Helper: persiste motivo de bloqueio em audit_logs (best-effort) ──
  async function recordDenial(
    reason: "missing_bearer" | "invalid_jwt" | "admin_role_required",
    extra: Record<string, unknown> = {},
  ) {
    try {
      const denialAdmin = createClient(supabaseUrl, serviceKey);
      await denialAdmin.from("audit_logs").insert({
        action: "create",
        table_name: "__rls_verification_denied",
        record_id: crypto.randomUUID(),
        actor_id: (extra.caller as string) ?? null,
        organization_id: null,
        new_data: {
          reason,
          request_id: requestId,
          ip: req.headers.get("x-forwarded-for") ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
          executed_at: new Date().toISOString(),
          ...extra,
        },
      });
    } catch (e) {
      log.error("rls_test_denial_audit_failed", { reason, error: (e as Error).message });
    }
  }

  // ── Auth guard: precisa de JWT válido E papel admin em alguma org ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.error("rls_test_unauthorized", { reason: "missing_bearer" });
    await recordDenial("missing_bearer");
    return new Response(
      JSON.stringify({ error: "Unauthorized", reason: "missing_bearer_token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    log.error("rls_test_unauthorized", { reason: "invalid_jwt", err: claimsErr?.message });
    await recordDenial("invalid_jwt", { jwt_error: claimsErr?.message ?? null });
    return new Response(
      JSON.stringify({ error: "Unauthorized", reason: "invalid_jwt" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const callerId = claimsData.claims.sub as string;
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: adminRows } = await adminClient
    .from("organization_members")
    .select("id")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .limit(1);
  if (!adminRows || adminRows.length === 0) {
    log.error("rls_test_forbidden", { caller: callerId, reason: "admin_role_required" });
    await recordDenial("admin_role_required", { caller: callerId });
    return new Response(
      JSON.stringify({ error: "Forbidden", reason: "admin_role_required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const anon = createClient(supabaseUrl, anonKey);

  const results: TestResult[] = [];

  // Helper: create temp user
  async function createTempUser(email: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPass123!",
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create user ${email}: ${error.message}`);
    return data.user;
  }

  // Helper: get authenticated client
  async function getAuthClient(email: string, password: string) {
    const client = createClient(supabaseUrl, anonKey);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Failed to sign in ${email}: ${error.message}`);
    return client;
  }

  const anonTables = RLS_TABLES.filter((t) => !t.excludeFromAnon).map((t) => t.table);
  const userAEmail = `rls-test-a-${Date.now()}@test.local`;
  const userBEmail = `rls-test-b-${Date.now()}@test.local`;

  try {
    // 1. Create two temp users
    const userA = await createTempUser(userAEmail);
    const userB = await createTempUser(userBEmail);
    const clientA = await getAuthClient(userAEmail, "TestPass123!");
    const clientB = await getAuthClient(userBEmail, "TestPass123!");

    // 2. Test: anon cannot read any table
    for (const table of anonTables) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      const passed = (data?.length === 0 || !!error);
      results.push({ name: `anon_cannot_read_${table}`, passed, detail: error?.message ?? `rows: ${data?.length ?? 0}` });
    }

    // 3. Test: anon cannot insert into any table
    for (const table of anonTables) {
      const { error } = await anon.from(table).insert({ name: "anon-test" } as Record<string, unknown>);
      results.push({ name: `anon_cannot_insert_${table}`, passed: !!error, detail: error?.message ?? "insert succeeded (BAD)" });
    }

    // 4. User A inserts a company; User B cannot see it
    const { data: compA } = await clientA.from("companies").insert({ name: "RLS-Test-A-Co" }).select("id").single();
    const companyIdA = compA?.id;

    const { data: bSeesA } = await clientB.from("companies").select("id").eq("id", companyIdA!);
    results.push({ name: "userB_cannot_see_userA_company", passed: (bSeesA?.length === 0), detail: `rows: ${bSeesA?.length}` });

    // 5. User B cannot update User A's company
    await clientB.from("companies").update({ name: "hacked" }).eq("id", companyIdA!);
    const { data: checkUpdate } = await clientA.from("companies").select("name").eq("id", companyIdA!).single();
    results.push({ name: "userB_cannot_update_userA_company", passed: checkUpdate?.name === "RLS-Test-A-Co", detail: `name after attempt: ${checkUpdate?.name}` });

    // 6. User B cannot delete User A's company
    await clientB.from("companies").delete().eq("id", companyIdA!);
    const { data: checkDel } = await clientA.from("companies").select("id").eq("id", companyIdA!);
    results.push({ name: "userB_cannot_delete_userA_company", passed: (checkDel?.length === 1), detail: `rows remaining: ${checkDel?.length}` });

    // 7. User A CAN see own company
    const { data: aSelf } = await clientA.from("companies").select("id").eq("id", companyIdA!);
    results.push({ name: "userA_can_see_own_company", passed: (aSelf?.length === 1), detail: `rows: ${aSelf?.length}` });

    // 8. Cross-table isolation for workflows
    const { data: wfA } = await clientA.from("workflows").insert({ name: "RLS-WF-A", steps: [] }).select("id").single();
    const { data: bSeesWf } = await clientB.from("workflows").select("id").eq("id", wfA?.id ?? "");
    results.push({ name: "userB_cannot_see_userA_workflow", passed: (bSeesWf?.length === 0), detail: `rows: ${bSeesWf?.length}` });

    // 9. Profile isolation
    const { data: profileB } = await clientB.from("profiles").select("id");
    const seesOnlySelf = profileB?.every(p => p.id === userB.id) ?? false;
    results.push({ name: "userB_sees_only_own_profile", passed: seesOnlySelf, detail: `profiles: ${profileB?.length}` });

    // ─────────────────────────────────────────────
    // 10. Cross-organization isolation suite
    // Cria duas organizações distintas (uma owned por A, outra por B)
    // e valida que membros de uma não enxergam/escrevem na outra.
    // ─────────────────────────────────────────────
    const slugA = `rls-org-a-${Date.now()}`;
    const slugB = `rls-org-b-${Date.now()}`;

    const { data: orgA, error: orgAErr } = await admin
      .from("organizations")
      .insert({ name: "RLS Org A", slug: slugA, owner_id: userA.id })
      .select("id")
      .single();
    if (orgAErr) throw new Error(`create orgA: ${orgAErr.message}`);

    const { data: orgB, error: orgBErr } = await admin
      .from("organizations")
      .insert({ name: "RLS Org B", slug: slugB, owner_id: userB.id })
      .select("id")
      .single();
    if (orgBErr) throw new Error(`create orgB: ${orgBErr.message}`);

    // Triggers `handle_new_organization` já adiciona o owner como admin.
    // Inserir uma empresa em cada org via service role (bypass RLS) para o setup:
    const { data: orgACompany } = await admin
      .from("companies")
      .insert({ name: "ORG-A-Company", organization_id: orgA.id, user_id: userA.id })
      .select("id")
      .single();
    const { data: orgBCompany } = await admin
      .from("companies")
      .insert({ name: "ORG-B-Company", organization_id: orgB.id, user_id: userB.id })
      .select("id")
      .single();

    // 10a. User A (membro de orgA) NÃO vê empresa da orgB
    const { data: aSeesOrgB } = await clientA
      .from("companies")
      .select("id")
      .eq("id", orgBCompany!.id);
    results.push({
      name: "orgA_member_cannot_read_orgB_company",
      passed: (aSeesOrgB?.length ?? 0) === 0,
      detail: `rows: ${aSeesOrgB?.length}`,
    });

    // 10b. User B (membro de orgB) NÃO vê empresa da orgA
    const { data: bSeesOrgA } = await clientB
      .from("companies")
      .select("id")
      .eq("id", orgACompany!.id);
    results.push({
      name: "orgB_member_cannot_read_orgA_company",
      passed: (bSeesOrgA?.length ?? 0) === 0,
      detail: `rows: ${bSeesOrgA?.length}`,
    });

    // 10c. User A NÃO consegue UPDATE em registro da orgB
    const { error: aUpdateBErr } = await clientA
      .from("companies")
      .update({ name: "pwned-by-A" })
      .eq("id", orgBCompany!.id);
    const { data: orgBNameCheck } = await admin
      .from("companies")
      .select("name")
      .eq("id", orgBCompany!.id)
      .single();
    results.push({
      name: "orgA_member_cannot_update_orgB_company",
      passed: orgBNameCheck?.name === "ORG-B-Company",
      detail: `name="${orgBNameCheck?.name}" rls_error=${aUpdateBErr?.message ?? "none"}`,
    });

    // 10d. User A NÃO consegue DELETE em registro da orgB
    await clientA.from("companies").delete().eq("id", orgBCompany!.id);
    const { data: orgBStillExists } = await admin
      .from("companies")
      .select("id")
      .eq("id", orgBCompany!.id);
    results.push({
      name: "orgA_member_cannot_delete_orgB_company",
      passed: (orgBStillExists?.length ?? 0) === 1,
      detail: `rows remaining: ${orgBStillExists?.length}`,
    });

    // 10e. User A NÃO consegue INSERT mirando organization_id da orgB
    const { error: aInsertBErr } = await clientA
      .from("companies")
      .insert({ name: "smuggled", organization_id: orgB.id });
    results.push({
      name: "orgA_member_cannot_insert_into_orgB",
      passed: !!aInsertBErr,
      detail: aInsertBErr?.message ?? "insert succeeded (BAD)",
    });

    // 10f. Cross-org isolation driven by shared whitelist (`RLS_TABLES`).
    // Garante que toda nova tabela multi-tenant adicionada ao registry
    // ganha automaticamente o teste de leitura cross-org.
    const ctx: Record<string, string> = {};
    const createdRows: Array<{ table: string; id: string }> = [];
    for (const spec of RLS_TABLES) {
      // Pula tabelas isentas no ambiente atual
      if (spec.envExempt?.includes(currentEnv)) {
        log.info("skipping_table_isolation_test", { table: spec.table, env: currentEnv });
        continue;
      }

      // Pula tabelas que já têm cobertura específica acima (companies)
      if (spec.table === "companies") continue;
      try {
        // Garantir que dependências foram criadas antes
        if (spec.requires) {
          const missing = spec.requires.filter((r) => !ctx[r]);
          if (missing.length) {
            results.push({
              name: `orgA_member_cannot_read_orgB_${spec.table}`,
              passed: false,
              detail: `dependências ausentes: ${missing.join(",")}`,
            });
            continue;
          }
        }
        const payload = spec.payload(orgB.id, userB.id, ctx);
        const { data: row, error: insertErr } = await admin
          .from(spec.table)
          .insert(payload)
          .select("id")
          .single();
        if (insertErr || !row) {
          results.push({
            name: `orgA_member_cannot_read_orgB_${spec.table}`,
            passed: false,
            detail: `setup falhou: ${insertErr?.message ?? "no row"}`,
          });
          continue;
        }
        ctx[spec.table] = row.id;
        createdRows.push({ table: spec.table, id: row.id });
        const { data: aSees } = await clientA.from(spec.table).select("id").eq("id", row.id);
        results.push({
          name: `orgA_member_cannot_read_orgB_${spec.table}`,
          passed: (aSees?.length ?? 0) === 0,
          detail: `rows: ${aSees?.length}`,
        });
      } catch (e) {
        results.push({
          name: `orgA_member_cannot_read_orgB_${spec.table}`,
          passed: false,
          detail: `exception: ${(e as Error).message}`,
        });
      }
    }
    // Cleanup created rows in reverse order to respect FK dependencies
    for (const { table, id } of createdRows.reverse()) {
      await admin.from(table).delete().eq("id", id);
    }

    // 10g. Coverage check: detecta tabelas RLS-enabled novas que ainda não
    // foram registradas no whitelist (nem listadas como exemptas).
    try {
      const knownNames = new Set([
        ...RLS_TABLES.map((t) => t.table),
        ...RLS_TABLES_EXEMPT,
        ...ENV_EXEMPT_TABLES[currentEnv],
      ]);
      const { data: rlsTables, error: covErr } = await admin.rpc("pg_catalog_rls_tables");
      if (!covErr && Array.isArray(rlsTables)) {
        const missing = (rlsTables as Array<{ table_name: string }>)
          .map((r) => r.table_name)
          .filter((name) => !knownNames.has(name));
        results.push({
          name: `rls_coverage_complete_${currentEnv}`,
          passed: missing.length === 0,
          detail: missing.length
            ? `tabelas RLS sem entrada no registry ou isenção em ${currentEnv}: ${missing.join(", ")}`
            : `${knownNames.size} tabelas registradas/isentas`,
        });
      } else {
        results.push({
          name: "rls_coverage_complete",
          passed: false,
          detail: `coverage check skipped (${covErr?.message}); ${knownNames.size} tabelas no registry`,
        });
      }
    } catch (e) {
      results.push({
        name: "rls_coverage_complete",
        passed: false,
        detail: `exception: ${(e as Error).message}`,
      });
    }

    // Cleanup orgs
    await admin.from("companies").delete().eq("id", orgACompany!.id);
    await admin.from("companies").delete().eq("id", orgBCompany!.id);
    await admin.from("organizations").delete().eq("id", orgA.id);
    await admin.from("organizations").delete().eq("id", orgB.id);

    // Cleanup
    await admin.from("companies").delete().eq("id", companyIdA!);
    if (wfA?.id) await admin.from("workflows").delete().eq("id", wfA.id);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);

  } catch (err) {
    log.error("rls_test_setup_error", { error: (err as Error).message });
    results.push({ name: "SETUP_ERROR", passed: false, detail: (err as Error).message });
  }

  const allPassed = results.every(r => r.passed);
  const duration = Math.round(performance.now() - start);
  log.info("rls_test_complete", {
    duration_ms: duration,
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
  });

  // ── Persist run in audit_logs for historical querying ──
  // Uses virtual table_name `__rls_verification`. Failures are kept in full;
  // successful results are summarized to keep payload small.
  try {
    const passedCount = results.filter(r => r.passed).length;
    const failedResults = results.filter(r => !r.passed);
    const runId = crypto.randomUUID();
    await admin.from("audit_logs").insert({
      action: "create",
      table_name: "__rls_verification",
      record_id: runId,
      actor_id: callerId,
      organization_id: adminRows[0].id ? null : null, // not tied to a single org
      new_data: {
        run_id: runId,
        all_passed: allPassed,
        total: results.length,
        passed: passedCount,
        failed: failedResults.length,
        duration_ms: duration,
        request_id: requestId,
        failed_results: failedResults,
        passed_names: results.filter(r => r.passed).map(r => r.name),
        executed_at: new Date().toISOString(),
      },
    });
  } catch (auditErr) {
    log.error("rls_test_audit_failed", { error: (auditErr as Error).message });
  }

  return new Response(
    JSON.stringify({ allPassed, total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2),
    { status: allPassed ? 200 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
