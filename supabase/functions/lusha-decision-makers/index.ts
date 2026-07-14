import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LUSHA_API_KEY = "07668666-792b-42bd-a933-b16a74bd10cf";
const LUSHA_API_URL = "https://api.lusha.com/v3/contacts/decision-makers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { domains, bitrix_card_id } = await req.json();

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return new Response(
        JSON.stringify({ error: "Campo 'domains' obrigatório (array de domínios)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companies = domains.map((domain: string, idx: number) => ({
      domain: domain.toLowerCase().trim(),
      clientReferenceId: bitrix_card_id ? `${bitrix_card_id}-${idx}` : `req-${idx}`,
    }));

    const lushaResp = await fetch(LUSHA_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": LUSHA_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ companies }),
    });

    if (!lushaResp.ok) {
      const errText = await lushaResp.text();
      return new Response(
        JSON.stringify({ error: "Lusha API error", status: lushaResp.status, detail: errText }),
        { status: lushaResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await lushaResp.json();

    const results = [];
    for (const item of data.results || []) {
      if (item.error) {
        results.push({
          domain: item.domain,
          clientReferenceId: item.clientReferenceId,
          error: item.error.code,
          decisionMakers: [],
        });
        continue;
      }

      const decisionMakers = (item.decisionMakers || []).map((dm: any) => ({
        id: dm.id,
        firstName: dm.firstName,
        lastName: dm.lastName,
        fullName: `${dm.firstName || ""} ${dm.lastName || ""}`.trim(),
        jobTitle: dm.jobTitle?.title || "",
        departments: dm.jobTitle?.departments || [],
        seniority: dm.jobTitle?.seniority || "",
        company: dm.company?.name || "",
        companyId: item.companyId,
        location: dm.location?.country || "",
        linkedin: dm.socialLinks?.linkedin || "",
        hasEmail: dm.has?.includes("emails") || false,
        hasPhone: dm.has?.includes("phones") || false,
        emailCredits: dm.canReveal?.find((r: any) => r.field === "emails")?.credits || 0,
        phoneCredits: dm.canReveal?.find((r: any) => r.field === "phones")?.credits || 0,
      }));

      results.push({
        domain: item.domain,
        companyId: item.companyId,
        clientReferenceId: item.clientReferenceId,
        total: decisionMakers.length,
        decisionMakers,
      });
    }

    return new Response(
      JSON.stringify({
        requestId: data.requestId,
        creditsCharged: 0,
        results,
        totalDecisionMakers: results.reduce(
          (acc: number, r: any) => acc + (r.decisionMakers?.length || 0),
          0
        ),
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
