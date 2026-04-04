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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    // Cleanup
    await admin.from("companies").delete().eq("id", companyIdA!);
    if (wfA?.id) await admin.from("workflows").delete().eq("id", wfA.id);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);

  } catch (err) {
    results.push({ name: "SETUP_ERROR", passed: false, detail: (err as Error).message });
  }

  const allPassed = results.every(r => r.passed);

  return new Response(
    JSON.stringify({ allPassed, total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2),
    { status: allPassed ? 200 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
