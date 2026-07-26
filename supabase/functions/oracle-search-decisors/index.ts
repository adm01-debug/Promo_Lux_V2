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
import { isUserOrgMember } from "../_shared/org-membership.ts";

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

  // service_role ignora RLS: sem esta checagem, um usuário autenticado em
  // qualquer org poderia passar o organization_id de outro tenant e a função
  // gravaria lusha_search_sessions/lusha_contacts nesse tenant alheio, além
  // de consumir o rate limit de busca da vítima (IDOR cross-tenant).
  if (!(await isUserOrgMember(admin, userId, input.organization_id))) {
    await logger.log({ step: "org_check", status: "error", level: "error", message: "usuário não pertence à organização informada" });
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

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
          // ⚠️ NÃO troque para "oracle_v2" nem invente valor novo. O CHECK
          // lusha_search_sessions_search_type_check só aceita 'department_search'
          // ou 'decision_makers_domain'. Provado por sonda em 17/07/2026:
          // 'oracle_v2' devolve 23514 e mata a função no passo 3 de 8, antes de
          // chamar a Lusha. Se precisar de um valor novo, faça MIGRATION ANTES.
          search_type: "department_search",
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
  type ContatoComOrigem = LushaSearchContact & { requestedPt: string; contactSource: "lusha" | "apollo" };
  const allContacts: ContatoComOrigem[] = [];
  const perDeptCount: Record<string, number> = {};
  const errors: Array<{ department: string; error: string }> = [];

  // ── Fallback Apollo: só entra quando a Lusha devolve ZERO num departamento.
  //    Nunca derruba a busca; qualquer falha vira errors[] + log degradado.
  let apolloEnabled = isApolloConfigured();
  let apolloSkippedReason: string | undefined = apolloEnabled ? undefined : "apollo_not_configured";
  if (apolloEnabled && !(await checkCircuitBreaker(admin, "apollo_search"))) {
    apolloEnabled = false;
    apolloSkippedReason = "circuit_breaker_open";
  }

  // Domínio normalizado — chave de casamento. Resolvido UMA vez por busca.
  let apolloDomain = "";
  if (apolloEnabled) {
    let companyWebsite: string | null = null;
    if (input.company_id) {
      const { data: comp } = await admin
        .from("companies")
        .select("website")
        .eq("id", input.company_id)
        .maybeSingle();
      companyWebsite = (comp as { website?: string | null } | null)?.website ?? null;
    }
    const rawMatch = (companyMatch.raw ?? {}) as Record<string, unknown>;
    const pick = (k: string) => (typeof rawMatch[k] === "string" ? (rawMatch[k] as string) : null);
    const resolved = resolveCompanyDomain({
      companyWebsite,
      lushaEmailDomain: pick("company_email_domain") ?? pick("email_domain"),
      lushaCompanyDomain: pick("fqdn") ?? pick("domain") ?? pick("website"),
    });
    apolloDomain = resolved.domain;
    if (!apolloDomain) {
      apolloEnabled = false;
      apolloSkippedReason = "no_reliable_domain";
    }
  }

  const apolloFallback = {
    attempted: false,
    departments: [] as string[],
    found: 0,
    ...(apolloSkippedReason ? { skipped_reason: apolloSkippedReason } : {}),
  };

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
      allContacts.push(...result.contacts.map((c) => ({ ...c, requestedPt: dept.pt, contactSource: "lusha" as const })));
      await reportSuccess(admin, "lusha_search");
      await logger.log({
        step: "dept_search", status: "success",
        message: `${dept.pt} [${dept.en.join(" | ")}]: ${result.contacts.length} de ${result.total}`,
        metadata: {
          department_pt: dept.pt, departments_en: dept.en,
          count: result.contacts.length, total_disponivel: result.total,
        },
      });

      // ── Fallback Apollo por departamento vazio
      if (result.contacts.length === 0 && apolloEnabled) {
        const filter = apolloFilterForLushaDepartments(dept.en);
        if (!filter) {
          await logger.log({
            step: "dept_fallback_apollo", status: "degraded",
            message: `${dept.pt}: sem mapeamento Apollo`, metadata: { departments_en: dept.en },
          });
        } else {
          apolloFallback.attempted = true;
          apolloFallback.departments.push(dept.pt);
          try {
            const ap = await searchPeopleByDomain({
              domain: apolloDomain,
              titles: filter.titles,
              departments: filter.departments,
              size: input.max_per_department,
            });
            allContacts.push(
              ...ap.contacts.map((c) => ({ ...c, requestedPt: dept.pt, contactSource: "apollo" as const })),
            );
            apolloFallback.found += ap.contacts.length;
            perDeptCount[dept.pt] = ap.contacts.length;
            await reportSuccess(admin, "apollo_search");
            await logger.log({
              step: "dept_fallback_apollo", status: "success",
              message: `${dept.pt}: ${ap.contacts.length} via Apollo (domínio ${apolloDomain})`,
              metadata: { department_pt: dept.pt, domain: apolloDomain, count: ap.contacts.length, total: ap.total },
            });
          } catch (err) {
            const e = err as { status?: number; disabled?: boolean; transient?: boolean };
            if (e.transient !== false) await reportFailure(admin, "apollo_search");
            if (e.disabled) {
              // 401/403 = chave sem acesso ao people search (exige master key).
              // Desliga o fallback para o resto da busca, em silêncio.
              apolloEnabled = false;
              apolloSkippedReason = "apollo_forbidden";
              (apolloFallback as { skipped_reason?: string }).skipped_reason = "apollo_forbidden";
            }
            errors.push({ department: dept.pt, error: `apollo: ${(err as Error).message}` });
            await logger.log({
              step: "dept_fallback_apollo", status: "degraded", level: "warn",
              message: `fallback Apollo falhou em ${dept.pt}`,
              errorDetail: (err as Error).message,
              httpStatus: e.status,
              metadata: { department_pt: dept.pt, domain: apolloDomain },
            });
          }
        }
      }
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


  // 3) Dedup inicial por linkedin_public_id (mantido para reduzir trabalho a jusante)
  const seen = new Set<string>();
  const uniqueContacts = allContacts.filter((c) => {
    const pid = publicIdFromLinkedInUrl(c.linkedinUrl);
    const key = pid || `noid:${c.fullName}:${c.jobTitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3) Particiona: contatos COM linkedin_public_id vs SEM.
  //    publicIdFromLinkedInUrl espelha o SQL da coluna GENERATED linkedin_public_id.
  //    - COM pid  -> upsert por (organization_id, linkedin_public_id), o índice
  //      único deduplica no banco.
  //    - SEM pid  -> linkedin_public_id vira NULL, e no Postgres NULL não conflita
  //      com NULL (o ON CONFLICT NUNCA dispara). Sem tratamento, cada re-execução
  //      DUPLICA. Provado por sonda SQL em 17/07/2026. Então esses passam por um
  //      guard explícito .maybeSingle() antes de inserir.
  const dedupIntra = new Set<string>();
  const comLinkedin: typeof allContacts = [];
  const semLinkedinSeen = new Set<string>();
  const semLinkedin: typeof allContacts = [];

  for (const c of uniqueContacts) {
    const pid = publicIdFromLinkedInUrl(c.linkedinUrl);
    if (pid) {
      if (dedupIntra.has(pid)) continue; // já deduplicado no passo anterior, mas garante
      dedupIntra.add(pid);
      comLinkedin.push(c);
    } else {
      const k = `${(c.fullName || "").toLowerCase().trim()}|${(c.jobTitle || "").toLowerCase().trim()}`;
      if (!k.replace("|", "")) continue; // sem nome E sem cargo -> descarta
      if (semLinkedinSeen.has(k)) continue;
      semLinkedinSeen.add(k);
      semLinkedin.push(c);
    }
  }

  const mkRow = (c: ContatoComOrigem) => ({
    session_id: sessionId,
    company_id: input.company_id ?? null,
    user_id: userId,
    organization_id: input.organization_id,
    lusha_company_name: companyMatch.name,
    lusha_company_lid: String(companyMatch.companyLid),
    full_name: c.fullName,
    job_title: c.jobTitle || null,
    department_en: c.department || null,
    department_pt: c.requestedPt || null,
    seniority: c.seniority || null,
    linkedin_url: c.linkedinUrl ?? null,
    enrichment_status: "pending_enrichment",
    raw_lusha_payload: c.raw as Record<string, unknown>,
  });

  let insertedCount = 0;
  let dedupCount = 0;

  // 4a) COM linkedin: upsert por índice único. Para CONTAR certo (o .select() com
  //     ignoreDuplicates não devolve as puladas de forma confiável), pergunto ao
  //     banco quais pids JÁ existiam ANTES, e conto a diferença.
  if (comLinkedin.length > 0) {
    const pids = comLinkedin
      .map((c) => publicIdFromLinkedInUrl(c.linkedinUrl))
      .filter((p) => p.length > 0);

    const { data: jaExistem } = await admin
      .from("lusha_contacts")
      .select("linkedin_public_id")
      .eq("organization_id", input.organization_id)
      .in("linkedin_public_id", pids);
    const existentes = new Set((jaExistem ?? []).map((r) => (r as { linkedin_public_id: string }).linkedin_public_id));

    const { error: upErr } = await admin
      .from("lusha_contacts")
      .upsert(comLinkedin.map(mkRow), {
        onConflict: "organization_id,linkedin_public_id",
        ignoreDuplicates: true,
      });
    if (upErr) {
      await logger.log({ step: "insert_contacts", status: "error", level: "error", message: "falha no upsert (com linkedin)", errorDetail: upErr.message });
    } else {
      const novos = pids.filter((p) => !existentes.has(p)).length;
      insertedCount += novos;
      dedupCount += comLinkedin.length - novos;
    }
  }

  // 4b) SEM linkedin: guard explícito, um a um (são raros — 0 de 100 na medição real).
  for (const c of semLinkedin) {
    const { data: existe } = await admin
      .from("lusha_contacts")
      .select("id")
      .eq("organization_id", input.organization_id)
      .is("linkedin_public_id", null)
      .eq("full_name", c.fullName)
      .eq("job_title", c.jobTitle || "")
      .maybeSingle();
    if (existe) { dedupCount += 1; continue; }

    const { error: insErr } = await admin.from("lusha_contacts").insert(mkRow(c));
    if (insErr) {
      // 23505 aqui = corrida (outra execução inseriu o mesmo entre o SELECT e o INSERT).
      // Não é erro fatal: trata como duplicado.
      if ((insErr as { code?: string }).code === "23505") { dedupCount += 1; }
      else { await logger.log({ step: "insert_contacts", status: "error", level: "error", message: "falha no insert (sem linkedin)", errorDetail: insErr.message }); }
    } else {
      insertedCount += 1;
    }
  }

  const totalUnicos = comLinkedin.length + semLinkedin.length;

  const finalStatus = errors.length > 0 && insertedCount === 0 ? "error" : "completed";
  await admin.from("lusha_search_sessions").update({
    status: finalStatus,
    progress_pct: 100,
    total_found: totalUnicos,
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
    metadata: { perDeptCount, errors, company_lid: companyMatch.companyLid },
  });

  return new Response(
    JSON.stringify({
      session_id: sessionId,
      company: { lid: companyMatch.companyLid, name: companyMatch.name },
      total_found: totalUnicos,
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
