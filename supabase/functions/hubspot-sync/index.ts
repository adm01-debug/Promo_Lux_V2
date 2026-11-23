// HubSpot sync edge function
// Sincroniza empresas e deals da org para o HubSpot CRM via Private App API.
// Modo cron (org-wide) ou single-company (admin JWT).
//
// Auth:
//  - Cron: header CRON_SERVICE_KEY (isCronAuthorized). Body: { org_id }.
//  - Admin JWT: Authorization Bearer <user jwt>, body { org_id, company_id? }.
//
// Config: org admin guarda a API key da Private App em org_integrations (provider='hubspot').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isCronAuthorized } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const HUBSPOT_API = "https://api.hubapi.com";

interface HubCompanyProps {
  name?: string;
  domain?: string;
  phone?: string;
  city?: string;
  industry?: string;
  description?: string;
  numberofemployees?: string;
  annualrevenue?: string;
  website?: string;
  linkedin_company_page?: string;
}

function buildCompanyProps(company: Record<string, unknown>): HubCompanyProps {
  const raw = (company.raw_data ?? {}) as Record<string, unknown>;
  const props: HubCompanyProps = {
    name: company.name as string | undefined,
    domain: (company.website as string | undefined)?.replace(/^https?:\/\//, ""),
    phone: company.phone as string | undefined,
    city: company.location as string | undefined,
    industry: company.sector as string | undefined,
    description: company.description as string | undefined,
    numberofemployees: company.employees ? String(company.employees) : undefined,
    annualrevenue: company.revenue ? String(company.revenue) : undefined,
    website: company.website as string | undefined,
    linkedin_company_page: (raw.linkedin_url ?? raw.linkedin) as string | undefined,
  };
  Object.keys(props).forEach((k) => {
    if ((props as Record<string, unknown>)[k] === undefined) {
      delete (props as Record<string, unknown>)[k];
    }
  });
  return props;
}

async function upsertHubSpotCompany(
  apiKey: string,
  company: Record<string, unknown>,
): Promise<{ hs_id: string; action: "created" | "updated" }> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const props = buildCompanyProps(company);

  // Busca por domain; fallback por name exato
  if (props.domain) {
    const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/companies/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: props.domain }] }],
        limit: 1,
      }),
    });
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as { results: Array<{ id: string }> };
      if (searchData.results.length > 0) {
        const hs_id = searchData.results[0].id;
        await fetch(`${HUBSPOT_API}/crm/v3/objects/companies/${hs_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ properties: props }),
        });
        return { hs_id, action: "updated" };
      }
    }
  }

  const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/companies`, {
    method: "POST",
    headers,
    body: JSON.stringify({ properties: props }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`HubSpot create failed: ${err}`);
  }
  const created = (await createRes.json()) as { id: string };
  return { hs_id: created.id, action: "created" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const isCron = isCronAuthorized(req);
  let orgId: string | undefined;
  let companyId: string | undefined;

  if (!isCron) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return json({ error: "unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as { org_id?: string; company_id?: string };
    orgId = body.org_id;
    companyId = body.company_id;
    if (!orgId) return json({ error: "org_id obrigatorio" }, 400);

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();
    if (!member || member.role !== "admin") {
      return json({ error: "apenas administradores podem sincronizar" }, 403);
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { org_id?: string };
    orgId = body.org_id;
    if (!orgId) return json({ error: "org_id obrigatorio em modo cron" }, 400);
  }

  const { data: orgData } = await supabase
    .from("org_integrations")
    .select("config")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .eq("enabled", true)
    .single();

  const apiKey = (orgData?.config as { api_key?: string } | null)?.api_key;
  if (!apiKey) return json({ error: "HubSpot nao configurado para esta org" }, 400);

  let companiesQuery = supabase
    .from("companies")
    .select("id, name, website, phone, location, sector, description, employees, revenue, raw_data")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .limit(100);

  if (companyId) {
    companiesQuery = supabase
      .from("companies")
      .select("id, name, website, phone, location, sector, description, employees, revenue, raw_data")
      .eq("organization_id", orgId)
      .eq("id", companyId)
      .is("deleted_at", null);
  }

  const { data: companies, error: compErr } = await companiesQuery;
  if (compErr) return json({ error: compErr.message }, 500);

  const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

  for (const company of (companies ?? [])) {
    try {
      const { action } = await upsertHubSpotCompany(apiKey, company as Record<string, unknown>);
      if (action === "created") results.created++;
      else results.updated++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${company.name}: ${(err as Error).message}`);
    }
  }

  await supabase
    .from("org_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");

  return json({
    org_id: orgId,
    companies_synced: (companies ?? []).length,
    ...results,
    synced_at: new Date().toISOString(),
  });
});
