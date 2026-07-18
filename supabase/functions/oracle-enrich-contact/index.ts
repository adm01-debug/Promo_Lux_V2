// ============================================================================
// oracle-enrich-contact
// Fase 4 — Substitui o subprocesso do n8n.
// Input: { contact_ids: uuid[1..50] }
// Para cada contato:
//   1. Marca enrichment_status='enriching' via UPDATE ... RETURNING id (skip se já enriquecendo)
//   2. Chama findEmailAll + findPhone em paralelo (LeadContact)
//   3. Escolhe melhor email/phone (verified > work > primeiro)
//   4. Normaliza telefone BR
//   5. UPSERT parcial: só grava email/phone se antes eram null
//   6. Marca status final: enriched | not_found | error_*
// Circuit breakers separados por serviço (email/phone).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCookie, CookieVaultUnavailable, CookieNotReady } from "../_shared/cookies.ts";
import { findEmailAll, findPhone, LeadContactError, type FoundEmail, type FoundPhone } from "../_shared/leadcontact-client.ts";
import { formatPhoneBitrix } from "../_shared/phone-br.ts";
import { checkCircuitBreaker, reportFailure, reportSuccess } from "../_shared/circuit-breaker.ts";
import { OracleLogger } from "../_shared/oracle-logger.ts";
import { updateContact } from "../_shared/safe-update.ts";
import { getUserOrgIds } from "../_shared/org-membership.ts";

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
  contact_ids: z.array(z.string().uuid()).min(1).max(50),
});

interface ContactRow {
  id: string;
  organization_id: string;
  user_id: string;
  linkedin_url: string | null;
  email: string | null;
  phone_formatted: string | null;
  enrichment_status: string | null;
}

interface EnrichResult {
  contact_id: string;
  status: "enriched" | "not_found" | "error_auth" | "error_rate_limit" | "error_other" | "skipped";
  email?: string | null;
  phone?: string | null;
  error?: string;
}

function pickBestEmail(emails: FoundEmail[]): FoundEmail | null {
  if (emails.length === 0) return null;
  const verified = emails.find((e) => e.verified);
  if (verified) return verified;
  const work = emails.find((e) => (e.type ?? "").toLowerCase() === "work");
  return work ?? emails[0];
}

function pickBestPhone(phones: FoundPhone[]): FoundPhone | null {
  if (phones.length === 0) return null;
  const brMobile = phones.find((p) => p.normalized.country === "BR" && p.normalized.is_mobile);
  if (brMobile) return brMobile;
  const br = phones.find((p) => p.normalized.country === "BR");
  return br ?? phones[0];
}

async function enrichOne(
  admin: ReturnType<typeof createClient>,
  contact: ContactRow,
  logger: OracleLogger,
): Promise<EnrichResult> {
  if (!contact.linkedin_url) {
    await updateContact(admin, logger, contact.id, {
      enrichment_status: "not_found",
      last_error: "sem linkedin_url",
      last_enriched_at: new Date().toISOString(),
    }, "mark_not_found");
    return { contact_id: contact.id, status: "not_found", error: "sem linkedin_url" };
  }

  // Executa email e phone em paralelo, mas tratados individualmente
  const [emailRes, phoneRes] = await Promise.allSettled([
    findEmailAll(contact.linkedin_url),
    findPhone(contact.linkedin_url),
  ]);

  let bestEmail: FoundEmail | null = null;
  let rawEmail: unknown = null;
  let emailStatus: "ok" | "auth" | "rate" | "other" | "empty" = "empty";
  if (emailRes.status === "fulfilled") {
    bestEmail = pickBestEmail(emailRes.value.emails);
    rawEmail = emailRes.value.raw;
    emailStatus = bestEmail ? "ok" : "empty";
    await reportSuccess(admin, "leadcontact_email");
  } else {
    const err = emailRes.reason;
    const status = err instanceof LeadContactError ? err.status : undefined;
    emailStatus = status === 401 || status === 403 ? "auth" : status === 429 ? "rate" : "other";
    await reportFailure(admin, "leadcontact_email");
    await logger.log({
      step: "enrich_email", status: "error", level: "error",
      message: "leadcontact email falhou", errorDetail: (err as Error).message,
      httpStatus: status, metadata: { contact_id: contact.id },
    });
  }

  let bestPhone: FoundPhone | null = null;
  let rawPhone: unknown = null;
  let phoneStatus: "ok" | "auth" | "rate" | "other" | "empty" = "empty";
  if (phoneRes.status === "fulfilled") {
    bestPhone = pickBestPhone(phoneRes.value.phones);
    rawPhone = phoneRes.value.raw;
    phoneStatus = bestPhone ? "ok" : "empty";
    await reportSuccess(admin, "leadcontact_phone");
  } else {
    const err = phoneRes.reason;
    const status = err instanceof LeadContactError ? err.status : undefined;
    phoneStatus = status === 401 || status === 403 ? "auth" : status === 429 ? "rate" : "other";
    await reportFailure(admin, "leadcontact_phone");
    await logger.log({
      step: "enrich_phone", status: "error", level: "error",
      message: "leadcontact phone falhou", errorDetail: (err as Error).message,
      httpStatus: status, metadata: { contact_id: contact.id },
    });
  }

  // Decide status final
  let finalStatus: EnrichResult["status"];
  let errMsg: string | null = null;
  if (emailStatus === "auth" || phoneStatus === "auth") {
    finalStatus = "error_auth";
    errMsg = "cookie leadcontact inválido/expirado";
  } else if (emailStatus === "rate" || phoneStatus === "rate") {
    finalStatus = "error_rate_limit";
    errMsg = "leadcontact rate limit";
  } else if (emailStatus === "other" && phoneStatus === "other") {
    finalStatus = "error_other";
    errMsg = "falhas em email e phone";
  } else if (!bestEmail && !bestPhone) {
    finalStatus = "not_found";
  } else {
    finalStatus = "enriched";
  }

  // UPSERT parcial: só sobrescreve se antes era null
  const updates: Record<string, unknown> = {
    enrichment_status: finalStatus,
    last_enriched_at: new Date().toISOString(),
    last_error: errMsg,
    enrichment_attempts: 1,
    raw_leadcontact_email: rawEmail,
    raw_leadcontact_phone: rawPhone,
  };
  if (bestEmail && !contact.email) {
    updates.email = bestEmail.email;
    updates.email_source = "leadcontact";
  }
  if (bestPhone && !contact.phone_formatted) {
    updates.phone_raw = bestPhone.raw;
    updates.phone_formatted = formatPhoneBitrix(bestPhone.normalized) ?? bestPhone.raw;
    updates.phone_source = "leadcontact";
  }


  await updateContact(admin, logger, contact.id, updates, "save_enrichment");

  return {
    contact_id: contact.id,
    status: finalStatus,
    email: bestEmail?.email ?? null,
    phone: bestPhone?.normalized.e164 ?? bestPhone?.raw ?? null,
    error: errMsg ?? undefined,
  };
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

  // Auth
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
    admin, source: "oracle-enrich-contact", correlationId,
    userId, organizationId: null,
  });

  // Circuit breakers pré-execução
  for (const svc of ["cookie_vault", "leadcontact_email", "leadcontact_phone"]) {
    if (!(await checkCircuitBreaker(admin, svc))) {
      await logger.log({ step: "cb_check", status: "error", level: "error", message: `${svc} aberto` });
      return new Response(JSON.stringify({ error: `${svc}_open` }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  // Preflight cookie leadcontact
  try {
    await getCookie("leadcontact");
    await reportSuccess(admin, "cookie_vault");
  } catch (err) {
    await reportFailure(admin, "cookie_vault");
    const isNotReady = err instanceof CookieNotReady;
    const isUnavailable = err instanceof CookieVaultUnavailable;
    await logger.log({
      step: "cookie_preflight", status: "error", level: "error",
      message: "cookie leadcontact indisponível",
      errorDetail: (err as Error).message, transient: isUnavailable,
    });
    return new Response(
      JSON.stringify({ error: isNotReady ? "cookie_not_ready" : "vault_unavailable", detail: (err as Error).message }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // service_role ignora RLS: sem esta checagem, um usuário autenticado em
  // qualquer org poderia enviar contact_ids de outra organização e a função
  // gastaria créditos LeadContact e gravaria email/telefone descoberto em
  // contatos de um tenant alheio (IDOR cross-tenant).
  const allowedOrgIds = await getUserOrgIds(admin, userId);
  if (allowedOrgIds.length === 0) {
    await logger.log({ step: "org_check", status: "skipped", level: "warn", message: "usuário sem organização — nenhum contato elegível" });
    return new Response(
      JSON.stringify({ results: [], summary: { enriched: 0, not_found: 0, error_auth: 0, error_rate_limit: 0, error_other: 0, skipped: input.contact_ids.length }, skipped: input.contact_ids, correlation_id: correlationId }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Carrega contatos e "trava" via UPDATE atômico (só quem ainda não está enriching)
  const { data: locked, error: lockErr } = await admin
    .from("lusha_contacts")
    .update({ enrichment_status: "enriching", enrichment_attempts: 0 })
    .in("id", input.contact_ids)
    .in("organization_id", allowedOrgIds)
    .neq("enrichment_status", "enriching")
    .select("id, organization_id, user_id, linkedin_url, email, phone_formatted, enrichment_status");

  if (lockErr) {
    await logger.log({ step: "lock_contacts", status: "error", level: "error", message: "falha ao travar contatos", errorDetail: lockErr.message });
    return new Response(JSON.stringify({ error: "lock_failed", detail: lockErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const contacts = (locked ?? []) as unknown as ContactRow[];
  const skipped = input.contact_ids.filter((id) => !contacts.some((c) => c.id === id));

  // Processa serialmente para não estourar o LeadContact (que é rate-limited)
  const results: EnrichResult[] = [];
  for (const contact of contacts) {
    try {
      const r = await enrichOne(admin, contact, logger);
      results.push(r);
      // Se cookie caiu no meio, abandona o lote
      if (r.status === "error_auth") break;
    } catch (err) {
      results.push({ contact_id: contact.id, status: "error_other", error: (err as Error).message });
      await updateContact(admin, logger, contact.id, {
        enrichment_status: "error_other",
        last_error: (err as Error).message,
        last_enriched_at: new Date().toISOString(),
      }, "mark_error");
    }
  }

  const summary = {
    enriched: results.filter((r) => r.status === "enriched").length,
    not_found: results.filter((r) => r.status === "not_found").length,
    error_auth: results.filter((r) => r.status === "error_auth").length,
    error_rate_limit: results.filter((r) => r.status === "error_rate_limit").length,
    error_other: results.filter((r) => r.status === "error_other").length,
    skipped: skipped.length,
  };

  await logger.log({
    step: "batch_done",
    status: summary.error_auth > 0 ? "error" : "success",
    message: `lote concluído: ${summary.enriched} enriquecidos, ${summary.not_found} não encontrados, ${summary.error_auth + summary.error_rate_limit + summary.error_other} erros`,
    durationMs: Date.now() - startedAt,
    metadata: summary,
  });

  return new Response(
    JSON.stringify({
      results, summary, skipped, correlation_id: correlationId,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
