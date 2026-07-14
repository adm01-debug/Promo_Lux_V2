import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        linkedinFollowersCount: dm.linkedinFollowersCount ?? null,
        linkedinConnectionsCount: dm.linkedinConnectionsCount ?? null,
        linkedinSkills: dm.linkedinSkills ?? [],
        linkedinCertifications: dm.linkedinCertifications ?? [],
        linkedinCourses: dm.linkedinCourses ?? [],
        linkedinAwards: dm.linkedinAwards ?? [],
        xUrl: dm.socialLinks?.xUrl ?? null,
      }));



      results.push({
        domain: item.domain,
        companyId: item.companyId,
        companyType: item.company?.companyType ?? null,
        companyLinkedinFollowers: item.company?.linkedinFollowers ?? null,
        companyEmailDomain: item.company?.emailDomain ?? null,
        lushaPopularityTier: item.company?.lushaPopularityTier ?? null,
        companyLocations: item.company?.companyLocations ?? [],
        clientReferenceId: item.clientReferenceId,
        total: decisionMakers.length,
        decisionMakers,
      });

    }

    // ── Persistência em public.lusha_contacts ──
    // Usa o JWT do chamador para que user_id/organization_id venham dos defaults
    // (auth.uid() e default_org_for_current_user()) e as políticas de RLS sejam
    // respeitadas. Só persiste decisores com linkedin_url (unique index).
    const persistence: {
      attempted: number;
      upserted: number;
      skipped: number;
      errors: string[];
    } = { attempted: 0, upserted: 0, skipped: 0, errors: [] };

    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const rows: Record<string, unknown>[] = [];
        for (const r of results) {
          if (r.error) continue;
          for (const dm of r.decisionMakers as any[]) {
            persistence.attempted++;
            if (!dm.linkedin) {
              persistence.skipped++;
              continue;
            }
            rows.push({
              lusha_company_name: r.domain,
              lusha_company_lid: r.companyId ?? null,
              full_name: dm.fullName || `${dm.firstName ?? ""} ${dm.lastName ?? ""}`.trim() || "Desconhecido",
              job_title: dm.jobTitle || null,
              department_en: dm.departments?.[0] ?? null,
              seniority: dm.seniority || null,
              linkedin_url: dm.linkedin,
              enrichment_status: "pending",
              bitrix_card_id: bitrix_card_id ?? null,
              confidence_score: 60,
              raw_lusha_payload: dm,
              linkedin_followers_count: dm.linkedinFollowersCount ?? null,
              linkedin_connections_count: dm.linkedinConnectionsCount ?? null,
              linkedin_skills: dm.linkedinSkills?.length ? dm.linkedinSkills : null,
              linkedin_certifications: dm.linkedinCertifications?.length ? dm.linkedinCertifications : null,
              linkedin_courses: dm.linkedinCourses?.length ? dm.linkedinCourses : null,
              linkedin_awards: dm.linkedinAwards?.length ? dm.linkedinAwards : null,
              x_url: dm.xUrl ?? null,
              company_locations: r.companyLocations?.length ? r.companyLocations : null,
              company_type: r.companyType ?? null,
              company_linkedin_followers: r.companyLinkedinFollowers ?? null,
              company_email_domain: r.companyEmailDomain ?? null,
              lusha_popularity_tier: r.lushaPopularityTier ?? null,
            });
          }
        }

        if (rows.length > 0) {
          const { error: upsertErr, count } = await supabase
            .from("lusha_contacts")
            .upsert(rows, {
              onConflict: "organization_id,linkedin_url",
              ignoreDuplicates: false,
              count: "exact",
            });
          if (upsertErr) {
            persistence.errors.push(upsertErr.message);
          } else {
            persistence.upserted = count ?? rows.length;
          }
        }
      } catch (persistErr) {
        persistence.errors.push((persistErr as Error).message);
      }
    } else {
      persistence.errors.push("no_auth_header_skipping_persistence");
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
