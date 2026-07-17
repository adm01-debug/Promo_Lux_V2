// ============================================================================
// oracle-search-decisors
// Fase 3 — Substitui o workflow master do n8n.
// Fluxo:
//   1. Preflight cookie 'lusha'
//   2. Resolve departments PT → EN (dept map)
//   3. Cria/recupera lusha_search_sessions (idempotência por hash)
//   4. Lusha companyName → escolhe melhor match
//   5. Loop search-agent por departamento
//   6. Dedup por (organization_id, linkedin_public_id)
//   7. Insere lusha_contacts com enrichment_status='pending_enrichment'
//   8. Atualiza progress_pct e totais na sessão
// NUNCA gasta crédito pago da Lusha (só endpoints dashboard).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { resolveDepartments } from "../_shared/lusha-departments.ts";
import { publicIdFromLinkedInUrl } from "../_shared/linkedin-url.ts";
import {
  searchCompanyByName,
  searchDecisors,
  type LushaSearchContact,
} from "../_shared/lusha-client.ts";
import { CookieVaultUnavailable, CookieNotReady, getCookie } from "../_shared/cookies.ts";
import { OracleLogger } from "../_shared/oracle-logger.ts";
import { checkCircuitBreaker, reportFailure, reportSuccess } from "../_shared/circuit-breaker.ts";

const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
];
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const InputSchema = z.object({
  company_name: z.string().min(2).max(200),
  departments: z.array(z.string().min(1).max(80)).min(1).max(20),
  organization_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  max_per_department: z.number().int().min(1).max(50).default(25),
  bitrix_company_id: z.string().min(1).max(32).optional(),
  bitrix_user_id: z.string().min(1).max(32).optional(),
});

async function hashIdempotency(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|"));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  // Auth JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Input
  let input: z.infer<typeof InputSchema>;
  try {
    input = InputSchema.parse(await req.json());
  } catch (err) {
    return new Response(JSON.stringify({ error: "bad_input", detail: (err as Error).message }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const logger = new OracleLogger({
    admin, source: "oracle-search-decisors", correlationId,
    userId, organizationId: input.organization_id,
  });

  // Circuit breakers
  if (!(await checkCircuitBreaker(admin, "cookie_vault"))) {
    await logger.log({ step: "cb_check", status: "error", level: "error", message: "cookie_vault circuit breaker aberto" });
    return new Response(JSON.stringify({ error: "cookie_vault_open" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  for (const svc of ["lusha_company", "lusha_search"]) {
    if (!(await checkCircuitBreaker(admin, svc))) {
      await logger.log({ step: "cb_check", status: "error", level: "error", message: `${svc} circuit breaker aberto` });
      return new Response(JSON.stringify({ error: `${svc}_open` }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  // Preflight cookie
  try {
    await getCookie("lusha");
    await reportSuccess(admin, "cookie_vault");
  } catch (err) {
    await reportFailure(admin, "cookie_vault");
    const isNotReady = err instanceof CookieNotReady;
    const isUnavailable = err instanceof CookieVaultUnavailable;
    await logger.log({
      step: "cookie_preflight",
      status: "error", level: "error",
      message: "cookie lusha indisponível",
      errorDetail: (err as Error).message,
      transient: isUnavailable,
    });
    return new Response(
      JSON.stringify({ error: isNotReady ? "cookie_not_ready" : "vault_unavailable", detail: (err as Error).message }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Rate limit por organização (30 buscas/hora)
  const { data: rl, error: rlErr } = await admin.rpc("check_oracle_rate_limit", {
    _organization_id: input.organization_id,
    _action: "search_decisors",
    _limit: 30,
  });
  if (rlErr) {
    await logger.log({ step: "rate_limit", status: "warning", level: "warn", message: "rate_limit_check_failed", errorDetail: rlErr.message });
  } else if (rl && Array.isArray(rl) && rl[0] && rl[0].allowed === false) {
    await logger.log({ step: "rate_limit", status: "error", level: "warn", message: "rate_limit_exceeded", metadata: { count: rl[0].current_count } });
    return new Response(
      JSON.stringify({ error: "rate_limit_exceeded", current_count: rl[0].current_count, reset_at: rl[0].reset_at, limit: 30 }),
      { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "3600" } },
    );
  }

  // Resolve departments

  const resolution = resolveDepartments(input.departments);
  if (resolution.mapped.length === 0) {
    await logger.log({
      step: "dept_resolve", status: "error", level: "error",
      message: "nenhum departamento mapeável", metadata: { input: input.departments, notFound: resolution.notFound },
    });
    return new Response(JSON.stringify({ error: "no_departments_mapped", not_found: resolution.notFound }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // departments_mapped é text[] NOT NULL no banco. resolution.mapped agora é
  // Array<{pt, en:string[]}> — achata para os enums, sem repetir.
  const departmentsMappedFlat = [...new Set(resolution.mapped.flatMap((d) => d.en))];

  // Idempotency
  // ⚠️ ANTES: resolution.mapped.slice().sort().join(",") — com objetos isso vira
  // "[object Object]" e TODA busca colidiria na mesma chave: a 2ª busca de
  // qualquer empresa devolveria o resultado da 1ª. Não quebra, só mente.
  const idemKey = await hashIdempotency([
    userId, input.organization_id, input.company_name.toLowerCase().trim(),
    resolution.mapped.map((d) => `${d.pt}:${d.en.slice().sort().join("+")}`).sort().join(","),
  ]);

  // Sessão (idempotente)
  let sessionId = input.session_id;
  if (!sessionId) {
    const { data: existing } = await admin
      .from("lusha_search_sessions")
      .select("id, status")
      .eq("idempotency_key", idemKey)
      .maybeSingle();

    if (existing && (existing as { status: string }).status === "completed") {
      await logger.log({ step: "idempotent_hit", status: "success", message: "sessão idêntica já concluída" });
      return new Response(JSON.stringify({ session_id: existing.id, idempotent: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    sessionId = existing?.id;

    if (!sessionId) {
      const { data: created, error: sErr } = await admin
        .from("lusha_search_sessions")
        .insert({
          user_id: userId,
          organization_id: input.organization_id,
          company_id: input.company_id ?? null,
          company_name: input.company_name,
          departments_requested: input.departments,
          departments_mapped: departmentsMappedFlat,
          departments_not_found: resolution.notFound,
          status: "running",
          progress_pct: 0,
          idempotency_key: idemKey,
          search_type: "oracle_v2",
          started_at: new Date().toISOString(),
          bitrix_company_id: input.bitrix_company_id ?? null,
          bitrix_user_id: input.bitrix_user_id ?? null,
        })
        .select("id")
        .single();
      if (sErr || !created) {
        await logger.log({ step: "session_create", status: "error", level: "error", message: "falha ao criar sessão", errorDetail: sErr?.message });
        return new Response(JSON.stringify({ error: "session_create_failed", detail: sErr?.message }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      sessionId = (created as { id: string }).id;
    }
  }

  // 1) Empresa
  let companyMatch;
  try {
    const matches = await searchCompanyByName(input.company_name);
    if (matches.length === 0) {
      await admin.from("lusha_search_sessions").update({
        status: "completed", progress_pct: 100, total_found: 0,
        completed_at: new Date().toISOString(), error_message: "empresa não encontrada na Lusha",
      }).eq("id", sessionId);
      await logger.log({ step: "company_search", status: "degraded", message: "empresa não encontrada", metadata: { name: input.company_name } });
      return new Response(JSON.stringify({ session_id: sessionId, total_found: 0, warning: "company_not_found" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    companyMatch = matches[0];
    await reportSuccess(admin, "lusha_company");
    await logger.log({ step: "company_search", status: "success", message: `empresa encontrada: ${companyMatch.name}`, metadata: { company_lid: companyMatch.companyLid, matches: matches.length } });
  } catch (err) {
    await reportFailure(admin, "lusha_company");
    const status = (err as { status?: number }).status;
    await logger.log({ step: "company_search", status: "error", level: "error", message: "falha na busca de empresa", errorDetail: (err as Error).message, httpStatus: status });
    return new Response(JSON.stringify({ error: "lusha_company_failed", detail: (err as Error).message }), {
      status: status === 401 || status === 403 ? 503 : 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await admin.from("lusha_search_sessions").update({
    lusha_company_lid: String(companyMatch.companyLid),
  }).eq("id", sessionId);

  // 2) Loop por departamento PEDIDO (preserva o significado de max_per_department:
  //    N por departamento escolhido, não N no total). Cada volta manda o ARRAY de
  //    enums daquele departamento — a Lusha faz OR + dedup nativo numa requisição
  //    só. Provado 17/07/2026: Sales(1421) + BusinessDevelopment(27) juntos = 1444,
  //    não 1448 — ela tira os 4 repetidos sozinha. Por isso "vendas" é 1 request.
  type ContatoComOrigem = LushaSearchContact & { requestedPt: string };
  const allContacts: ContatoComOrigem[] = [];
  const perDeptCount: Record<string, number> = {};
  const errors: Array<{ department: string; error: string }> = [];

  for (let i = 0; i < resolution.mapped.length; i++) {
    const dept = resolution.mapped[i];
    try {
      const result = await searchDecisors({
        companyName: companyMatch.name,
        companyLid: companyMatch.companyLid,
        departmentsEn: dept.en,
        size: input.max_per_department,
      });
      perDeptCount[dept.pt] = result.contacts.length;
      // O rótulo PT vem do que o usuário PEDIU nesta volta. Não usa lookup
      // reverso (findPtLabelForEn): era ambíguo quando 2 rótulos PT caem no
      // mesmo enum (ex.: "Compras" e "Logística" -> ambos Operations).
      allContacts.push(...result.contacts.map((c) => ({ ...c, requestedPt: dept.pt })));
      await reportSuccess(admin, "lusha_search");
      await logger.log({
        step: "dept_search", status: "success",
        message: `${dept.pt} [${dept.en.join(" | ")}]: ${result.contacts.length} de ${result.total}`,
        metadata: {
          department_pt: dept.pt, departments_en: dept.en,
          count: result.contacts.length, total_disponivel: result.total,
        },
      });
    } catch (err) {
      await reportFailure(admin, "lusha_search");
      errors.push({ department: dept.pt, error: (err as Error).message });
      await logger.log({
        step: "dept_search", status: "error", level: "error",
        message: `falha em departamento ${dept.pt}`,
        errorDetail: (err as Error).message,
        httpStatus: (err as { status?: number }).status,
      });
    }
    const pct = Math.round(((i + 1) / resolution.mapped.length) * 90);
    await admin.from("lusha_search_sessions").update({ progress_pct: pct }).eq("id", sessionId);
  }

  // 3) Dedup por linkedin_public_id
  // c.linkedinPublicId NÃO EXISTE no payload real da Lusha (o campo é social_link).
  // Usa publicIdFromLinkedInUrl, que espelha o SQL da coluna GENERATED — se
  // divergir, o upsert em (organization_id, linkedin_public_id) recebe duplicata.
  const seen = new Set<string>();
  const uniqueContacts = allContacts.filter((c) => {
    const pid = publicIdFromLinkedInUrl(c.linkedinUrl);
    const key = pid || `noid:${c.fullName}:${c.jobTitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 4) Insere em lusha_contacts (idempotente por unique index)
  const toInsert = uniqueContacts.map((c) => ({
    session_id: sessionId,
    company_id: input.company_id ?? null,
    user_id: userId,
    organization_id: input.organization_id,
    lusha_company_name: companyMatch.name,
    lusha_company_lid: String(companyMatch.id),
    full_name: c.fullName,
    job_title: c.jobTitle ?? null,
    department_en: c.department ?? null,
    department_pt: findPtLabelForEn(c.department ?? "", input.departments),
    seniority: c.seniority ?? null,
    linkedin_url: c.linkedinUrl ?? null,
    enrichment_status: "pending_enrichment",
    raw_lusha_payload: c.raw as Record<string, unknown>,
  }));

  let insertedCount = 0;
  let dedupCount = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await admin
      .from("lusha_contacts")
      .upsert(toInsert, {
        onConflict: "organization_id,linkedin_public_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (insErr) {
      await logger.log({ step: "insert_contacts", status: "error", level: "error", message: "falha ao inserir contatos", errorDetail: insErr.message });
    } else {
      insertedCount = inserted?.length ?? 0;
      dedupCount = toInsert.length - insertedCount;
    }
  }

  const finalStatus = errors.length > 0 && insertedCount === 0 ? "error" : "completed";
  await admin.from("lusha_search_sessions").update({
    status: finalStatus,
    progress_pct: 100,
    total_found: uniqueContacts.length,
    total_duplicates: dedupCount,
    total_errors: errors.length,
    completed_at: new Date().toISOString(),
    error_message: errors.length > 0 ? errors.map((e) => `${e.department}: ${e.error}`).join("; ").slice(0, 500) : null,
  }).eq("id", sessionId);

  await logger.log({
    step: "search_done",
    status: finalStatus === "completed" ? "success" : "error",
    message: `concluído: ${insertedCount} inseridos, ${dedupCount} duplicados, ${errors.length} erros`,
    durationMs: Date.now() - startedAt,
    metadata: { perDeptCount, errors, companyId: companyMatch.id },
  });

  return new Response(
    JSON.stringify({
      session_id: sessionId,
      company: { id: companyMatch.id, name: companyMatch.name },
      total_found: uniqueContacts.length,
      inserted: insertedCount,
      duplicates: dedupCount,
      errors,
      departments_mapped: resolution.mapped,
      departments_not_found: resolution.notFound,
      correlation_id: correlationId,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
