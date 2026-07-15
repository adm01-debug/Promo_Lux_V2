import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LUSHA_API_KEY = Deno.env.get("LUSHA_API_KEY") ?? "";
const LUSHA_REVEAL_URL = "https://api.lusha.com/v2/person";

// ── CORS restrito às origens conhecidas ──────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
  "https://id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Revela contatos (emails + telefones) de decisores previamente enfileirados
 * via lusha-decision-makers, usando requestId + contactIds (Lusha V2 Person).
 *
 * ⚠️ REQUER autenticação — endpoint consome créditos pagos.
 *
 * Body:
 * {
 *   requestId: string,
 *   contactIds: string[],
 *   revealEmails?: boolean,   // default true
 *   revealPhones?: boolean,   // default true
 *   metadata?: { bitrix_card_id?: string }
 * }
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── 1) Autenticação obrigatória ─────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(
      JSON.stringify({ error: "unauthorized", detail: "Missing Bearer token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return new Response(
      JSON.stringify({ error: "server_misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ error: "unauthorized", detail: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── 2) Chave Lusha configurada? ─────────────────────────────────────────
  if (!LUSHA_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "lusha_not_configured",
        detail: "LUSHA_API_KEY não configurada nas secrets do projeto.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      requestId,
      contactIds,
      revealEmails = true,
      revealPhones = true,
      metadata,
    } = await req.json();

    if (!requestId || typeof requestId !== "string") {
      return new Response(
        JSON.stringify({ error: "Campo 'requestId' obrigatório (retornado por lusha-decision-makers)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Campo 'contactIds' obrigatório (array de IDs de decisores)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bound o tamanho do array (proteção contra abuso)
    if (contactIds.length > 100) {
      return new Response(
        JSON.stringify({ error: "contactIds excede o limite (máx. 100 por chamada)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const revealFields: string[] = [];
    if (revealEmails) revealFields.push("emails");
    if (revealPhones) revealFields.push("phones");

    if (revealFields.length === 0) {
      return new Response(
        JSON.stringify({ error: "Selecione ao menos um campo para revelar (revealEmails ou revealPhones)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lushaResp = await fetch(LUSHA_REVEAL_URL, {
      method: "POST",
      headers: {
        "x-api-key": LUSHA_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        requestId,
        contactIds,
        revealEmails,
        revealPhones,
      }),
    });

    if (!lushaResp.ok) {
      const errText = await lushaResp.text();
      console.error(JSON.stringify({
        function: "lusha-reveal",
        level: "error",
        msg: "lusha_api_error",
        status: lushaResp.status,
        user_id: userData.user.id,
        ts: new Date().toISOString(),
      }));
      return new Response(
        JSON.stringify({ error: "Lusha API error", status: lushaResp.status, detail: errText }),
        { status: lushaResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await lushaResp.json();

    // Estrutura da V2: data.contacts[contactId] => { data: {...}, error: {...} }
    const revealed = [];
    const contactsMap = data.contacts || {};

    for (const [contactId, entry] of Object.entries<any>(contactsMap)) {
      if (entry.error) {
        revealed.push({
          contactId,
          error: entry.error.message || entry.error.code || "reveal_failed",
        });
        continue;
      }

      const person = entry.data || {};
      revealed.push({
        contactId,
        firstName: person.firstName ?? null,
        lastName: person.lastName ?? null,
        fullName:
          person.fullName ??
          `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() ||
          null,
        jobTitle: person.jobTitle ?? null,
        emailAddresses: (person.emailAddresses || []).map((e: any) => ({
          email: e.email,
          type: e.type ?? null,
        })),
        phoneNumbers: (person.phoneNumbers || []).map((p: any) => ({
          number: p.number,
          type: p.type ?? null,
          doNotCall: p.doNotCall ?? null,
        })),
        company: person.company
          ? {
              name: person.company.name ?? null,
              domain: person.company.domain ?? null,
              website: person.company.website ?? null,
            }
          : null,
        linkedin: person.socialLinks?.linkedin ?? null,
      });
    }

    return new Response(
      JSON.stringify({
        requestId: data.requestId ?? requestId,
        creditsCharged: data.creditsCharged ?? null,
        totalRevealed: revealed.filter((r: any) => !r.error).length,
        totalRequested: contactIds.length,
        revealed,
        metadata: metadata ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
