import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

  const tables = ["companies", "workflows", "campaigns", "notifications", "scrape_jobs", "intent_signals", "stakeholders"] as const;
  const userAEmail = `rls-test-a-${Date.now()}@test.local`;
  const userBEmail = `rls-test-b-${Date.now()}@test.local`;

  try {
    // 1. Create two temp users
    const userA = await createTempUser(userAEmail);
    const userB = await createTempUser(userBEmail);
    const clientA = await getAuthClient(userAEmail, "TestPass123!");
    const clientB = await getAuthClient(userBEmail, "TestPass123!");

    // 2. Test: anon cannot read any table
    for (const table of tables) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      const passed = (data?.length === 0 || !!error);
      results.push({ name: `anon_cannot_read_${table}`, passed, detail: error?.message ?? `rows: ${data?.length ?? 0}` });
    }

    // 3. Test: anon cannot insert into any table
    for (const table of tables) {
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
    const { data: bSeesWf } = await clientB.from("workflows").select("id").eq("id", wfA?.id!);
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

    // 10f. Tabelas auxiliares (workflows, deals, stakeholders, notifications)
    const auxTables = ["workflows", "deals", "stakeholders", "notifications", "intent_signals"] as const;
    for (const t of auxTables) {
      const payload: Record<string, unknown> = { organization_id: orgB.id, user_id: userB.id };
      if (t === "workflows") Object.assign(payload, { name: `wf-${t}`, steps: [] });
      if (t === "deals") {
        // precisa de stage_id; cria um stage para orgB primeiro
        const { data: stage } = await admin
          .from("deal_stages")
          .insert({ name: "RLS-stage", organization_id: orgB.id, user_id: userB.id })
          .select("id")
          .single();
        Object.assign(payload, { title: "deal-x", stage_id: stage!.id });
      }
      if (t === "stakeholders") Object.assign(payload, { full_name: "Person X" });
      if (t === "notifications") Object.assign(payload, { title: "n", message: "m" });
      if (t === "intent_signals") Object.assign(payload, { company_name: "X", signal: "visit" });

      const { data: row } = await admin.from(t).insert(payload).select("id").single();
      const { data: aSees } = await clientA.from(t).select("id").eq("id", row!.id);
      results.push({
        name: `orgA_member_cannot_read_orgB_${t}`,
        passed: (aSees?.length ?? 0) === 0,
        detail: `rows: ${aSees?.length}`,
      });
      await admin.from(t).delete().eq("id", row!.id);
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

  return new Response(
    JSON.stringify({ allPassed, total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2),
    { status: allPassed ? 200 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
