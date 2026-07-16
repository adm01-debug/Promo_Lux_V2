// ============================================================================
// oracle-push-bitrix
// Fase 5 — Substitui a cauda do Workflow 2 do n8n (nós Bitrix24).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  BITRIX_STAGES,
  BitrixError,
  createCard,
  createContact,
  findDuplicateContact,
  updateCardStage,
} from "../_shared/bitrix-client.ts";
import { checkCircuitBreaker, reportFailure, reportSuccess } from "../_shared/circuit-breaker.ts";
import { OracleLogger } from "../_shared/oracle-logger.ts";
import { updateContact } from "../_shared/safe-update.ts";

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
  bitrix_company_id: z.string().min(1).max(32).optional(),
  bitrix_assigned_by_id: z.coerce.number().int().positive().optional(),
});

interface ContactRow {
  id: string;
  session_id: string | null;
  organization_id: string;
  full_name: string;
  job_title: string | null;
  department_pt: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone_formatted: string | null;
  bitrix_contact_id: string | null;
}

interface SessionCtx {
  bitrix_card_id: string | null;
  bitrix_user_id: string | null;
  bitrix_company_id: string | null;
  departments_requested: string[] | null;
}

type PushStatus = "sent_to_bitrix" | "bitrix_duplicate" | "error_bitrix" | "skipped";

interface PushResult {
  contact_id: string;
  status: PushStatus;
  bitrix_contact_id?: string | null;
  bitrix_card_id?: string | null;
  matched_by?: string;
  error?: string;
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
    admin, source: "oracle-push-bitrix", correlationId, userId, organizationId: null,
  });

  if (!Deno.env.get("BITRIX_WEBHOOK_BASE")) {
    await logger.log({ step: "config", status: "error", level: "error", message: "BITRIX_WEBHOOK_BASE ausente" });
    return new Response(JSON.stringify({ error: "bitrix_not_configured" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!(await checkCircuitBreaker(admin, "bitrix"))) {
    await logger.log({ step: "cb_check", status: "error", level: "error", message: "bitrix circuit breaker aberto" });
    return new Response(JSON.stringify({ error: "bitrix_open" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: orgRow } = await admin
    .from("lusha_contacts").select("organization_id").eq("id", input.contact_ids[0]).maybeSingle();
  const organizationId = (orgRow as { organization_id?: string } | null)?.organization_id ?? null;

  if (organizationId) {
    const { data: rl } = await admin.rpc("check_oracle_rate_limit", {
      _organization_id: organizationId,
      _action: "push_bitrix",
      _limit: 200,
    });
    if (rl && Array.isArray(rl) && rl[0] && rl[0].allowed === false) {
      await logger.log({ step: "rate_limit", status: "error", level: "warn", message: "rate_limit_exceeded" });
      return new Response(
        JSON.stringify({ error: "rate_limit_exceeded", reset_at: rl[0].reset_at, limit: 200 }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "3600" } },
      );
    }
  }

  const { data: locked, error: lockErr } = await admin
    .from("lusha_contacts")
    .update({ enrichment_status: "pushing_bitrix" })
    .in("id", input.contact_ids)
    .eq("enrichment_status", "enriched")
    .is("bitrix_contact_id", null)
    .select("id, session_id, organization_id, full_name, job_title, department_pt, linkedin_url, email, phone_formatted, bitrix_contact_id");

  if (lockErr) {
    await logger.log({ step: "lock", status: "error", level: "error", message: "falha ao travar contatos", errorDetail: lockErr.message });
    return new Response(JSON.stringify({ error: "lock_failed", detail: lockErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const contacts = (locked ?? []) as unknown as ContactRow[];
  const skipped = input.contact_ids.filter((id) => !contacts.some((c) => c.id === id));

  if (contacts.length === 0) {
    await logger.log({ step: "lock", status: "skipped", message: "nenhum contato elegível (precisa estar 'enriched' e sem bitrix_contact_id)" });
    return new Response(
      JSON.stringify({ results: [], summary: { sent: 0, duplicates: 0, errors: 0, skipped: skipped.length }, skipped, correlation_id: correlationId }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const sessionIds = [...new Set(contacts.map((c) => c.session_id).filter(Boolean))] as string[];
  const sessions = new Map<string, SessionCtx>();
  if (sessionIds.length > 0) {
    const { data: srows } = await admin
      .from("lusha_search_sessions")
      .select("id, bitrix_card_id, bitrix_user_id, bitrix_company_id, departments_requested")
      .in("id", sessionIds);
    for (const s of (srows ?? []) as Array<SessionCtx & { id: string }>) {
      sessions.set(s.id, s);
    }
  }

  function ctxFor(c: ContactRow) {
    const s = c.session_id ? sessions.get(c.session_id) : undefined;
    return {
      codEmpresa: input.bitrix_company_id ?? s?.bitrix_company_id ?? null,
      assignedById: input.bitrix_assigned_by_id ?? (s?.bitrix_user_id ? Number(s.bitrix_user_id) : null),
      cardId: s?.bitrix_card_id ?? null,
      deptPt: c.department_pt ?? s?.departments_requested?.[0] ?? null,
    };
  }

  const cardsDeOrigem = [...new Set(contacts.map((c) => ctxFor(c).cardId).filter(Boolean))] as string[];
  for (const cardId of cardsDeOrigem) {
    try {
      await updateCardStage(cardId, BITRIX_STAGES.VERIFICANDO_DUPLICADOS);
    } catch (err) {
      await logger.log({ step: "stage_verificando", status: "degraded", level: "warn", message: `card ${cardId} não moveu`, errorDetail: (err as Error).message });
    }
  }

  const results: PushResult[] = [];
  let cadastrandoJaMovido = false;

  for (const c of contacts) {
    const ctx = ctxFor(c);

    if (!ctx.codEmpresa || !ctx.assignedById) {
      const msg = "contexto Bitrix ausente (bitrix_company_id / bitrix_assigned_by_id)";
      await admin.from("lusha_contacts").update({ enrichment_status: "error_bitrix", last_error: msg }).eq("id", c.id);
      results.push({ contact_id: c.id, status: "error_bitrix", error: msg });
      continue;
    }

    // Paridade com o n8n (nó "verifica se retornou dados"): sem email e sem
    // telefone não existe contato útil — não polui o CRM com casca vazia.
    if (!c.email && !c.phone_formatted) {
      const msg = "contato sem email e sem telefone";
      await admin.from("lusha_contacts").update({
        enrichment_status: "not_found",
        last_error: msg,
      }).eq("id", c.id);
      results.push({ contact_id: c.id, status: "skipped", error: msg });
      continue;
    }


    try {
      const dup = await findDuplicateContact({
        email: c.email,
        phone: c.phone_formatted,
        linkedinUrl: c.linkedin_url,
      });

      if (dup) {
        const cardId = await createCard({
          title: `Contato duplicado encontrado - ${c.full_name}`,
          stageId: BITRIX_STAGES.DUPLICADO,
          codEmpresa: ctx.codEmpresa,
          assignedById: ctx.assignedById,
        });
        await admin.from("lusha_contacts").update({
          enrichment_status: "bitrix_duplicate",
          bitrix_contact_id: dup.contactId,
          bitrix_card_id: cardId || null,
          is_duplicate: true,
          last_error: null,
        }).eq("id", c.id);

        await reportSuccess(admin, "bitrix");
        results.push({ contact_id: c.id, status: "bitrix_duplicate", bitrix_contact_id: dup.contactId, bitrix_card_id: cardId, matched_by: dup.matchedBy });
        await logger.log({ step: "dup_found", status: "success", message: `${c.full_name}: duplicado por ${dup.matchedBy}`, metadata: { contact_id: c.id, bitrix_contact_id: dup.contactId } });
        continue;
      }

      if (ctx.cardId && !cadastrandoJaMovido) {
        try {
          await updateCardStage(ctx.cardId, BITRIX_STAGES.CADASTRANDO);
          cadastrandoJaMovido = true;
        } catch { /* estágio é cosmético — não aborta o cadastro */ }
      }

      const bitrixContactId = await createContact({
        nome: c.full_name,
        cargo: c.job_title,
        email: c.email,
        telefone: c.phone_formatted,
        linkedinUrl: c.linkedin_url,
        codEmpresa: ctx.codEmpresa,
        departamentoPt: ctx.deptPt,
      });

      const cardId = await createCard({
        title: c.full_name,
        stageId: BITRIX_STAGES.CADASTRADO,
        codEmpresa: ctx.codEmpresa,
        assignedById: ctx.assignedById,
        contactId: bitrixContactId,
      });

      await admin.from("lusha_contacts").update({
        enrichment_status: "sent_to_bitrix",
        bitrix_contact_id: bitrixContactId,
        bitrix_card_id: cardId || null,
        last_error: null,
      }).eq("id", c.id);

      await reportSuccess(admin, "bitrix");
      results.push({ contact_id: c.id, status: "sent_to_bitrix", bitrix_contact_id: bitrixContactId, bitrix_card_id: cardId });
      await logger.log({ step: "contact_created", status: "success", message: `${c.full_name} → contato ${bitrixContactId}, card ${cardId}`, metadata: { contact_id: c.id } });
    } catch (err) {
      const be = err instanceof BitrixError ? err : null;
      await reportFailure(admin, "bitrix");
      const msg = (err as Error).message.slice(0, 300);
      await admin.from("lusha_contacts").update({
        enrichment_status: "error_bitrix",
        last_error: msg,
      }).eq("id", c.id);
      results.push({ contact_id: c.id, status: "error_bitrix", error: msg });
      await logger.log({
        step: "push_failed", status: "error", level: "error",
        message: `falha ao enviar ${c.full_name}`,
        errorDetail: msg, httpStatus: be?.status, transient: be?.transient,
        metadata: { contact_id: c.id },
      });

      if (be && (be.status === 401 || be.status === 403)) break;
    }
  }

  for (const sid of sessionIds) {
    const { count } = await admin
      .from("lusha_contacts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sid)
      .eq("enrichment_status", "sent_to_bitrix");
    await admin.from("lusha_search_sessions")
      .update({ total_inserted_bitrix: count ?? 0 })
      .eq("id", sid);
  }

  const summary = {
    sent: results.filter((r) => r.status === "sent_to_bitrix").length,
    duplicates: results.filter((r) => r.status === "bitrix_duplicate").length,
    errors: results.filter((r) => r.status === "error_bitrix").length,
    sem_dado: results.filter((r) => r.status === "skipped").length,
    skipped: skipped.length,
  };

  await logger.log({
    step: "batch_done",
    status: summary.errors > 0 && summary.sent === 0 ? "error" : "success",
    message: `Bitrix: ${summary.sent} cadastrados, ${summary.duplicates} duplicados, ${summary.errors} erros`,
    durationMs: Date.now() - startedAt,
    metadata: summary,
  });

  return new Response(
    JSON.stringify({ results, summary, skipped, correlation_id: correlationId }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
