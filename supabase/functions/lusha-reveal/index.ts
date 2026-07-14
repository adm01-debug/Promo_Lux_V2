import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LUSHA_API_KEY = "07668666-792b-42bd-a933-b16a74bd10cf";
const LUSHA_REVEAL_URL = "https://api.lusha.com/v2/person";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Revela contatos (emails + telefones) de decisores previamente enfileirados
 * via lusha-decision-makers, usando requestId + contactIds (Lusha V2 Person).
 *
 * Body:
 * {
 *   requestId: string,          // requestId retornado por lusha-decision-makers
 *   contactIds: string[],       // ids dos decisores a revelar
 *   revealEmails?: boolean,     // default true
 *   revealPhones?: boolean,     // default true
 *   metadata?: { bitrix_card_id?: string }
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
