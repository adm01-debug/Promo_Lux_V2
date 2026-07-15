import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { resolveDepartments, findPtLabelForEn } from "../_shared/departmentMap.ts";

// ── Quota diária por usuário (server-side) ──
const DAILY_SEARCH_QUOTA = Number(Deno.env.get("LUSHA_DAILY_QUOTA") ?? "50");

// ── CORS ──
const ALLOWED_ORIGINS = [
  "https://lux-ai-company-finder.lovable.app",
  "https://lux-ai-finder.lovable.app",
  "https://2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com",
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

// ── Structured Logger ──
function createLogger(requestId: string) {
  const base = { function: "lusha-search", request_id: requestId };
  return {
    info:  (msg: string, d?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info",  msg, ...d, ts: new Date().toISOString() })),
    warn:  (msg: string, d?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...base, level: "warn",  msg, ...d, ts: new Date().toISOString() })),
    error: (msg: string, d?: Record<string, unknown>) =>
      console.error(JSON.stringify({ ...base, level: "error", msg, ...d, ts: new Date().toISOString() })),
  };
}

// ── Mapeamento de Departamentos PT → EN (Lusha enum) ──
const DEPT_MAP: Record<string, string> = {
  "compras": "Operations",
  "suprimentos": "Operations",
  "logistica": "Operations",
  "logística": "Operations",
  "operacoes": "Operations",
  "operações": "Operations",
  "supply chain": "Operations",
  "supply": "Operations",
  "procurement": "Operations",
  "estoque": "Operations",
  "almoxarifado": "Operations",
  "marketing": "Marketing",
  "comunicacao": "Marketing",
  "comunicação": "Marketing",
  "publicidade": "Marketing",
  "branding": "Marketing",
  "growth": "Marketing",
  "digital": "Marketing",
  "recursos humanos": "Human Resources",
  "rh": "Human Resources",
  "gente": "Human Resources",
  "pessoas": "Human Resources",
  "talentos": "Human Resources",
  "dp": "Human Resources",
  "departamento pessoal": "Human Resources",
  "cultura": "Human Resources",
  "financeiro": "Finance",
  "financeira": "Finance",
  "controladoria": "Finance",
  "contabilidade": "Finance",
  "contabil": "Finance",
  "contábil": "Finance",
  "tesouraria": "Finance",
  "fiscal": "Finance",
  "tributario": "Finance",
  "tributário": "Finance",
  "financas": "Finance",
  "finanças": "Finance",
  "ti": "Information Technology",
  "tecnologia": "Information Technology",
  "sistemas": "Information Technology",
  "tic": "Information Technology",
  "infraestrutura": "Information Technology",
  "infra": "Information Technology",
  "desenvolvimento": "Information Technology",
  "dev": "Information Technology",
  "dados": "Information Technology",
  "data": "Information Technology",
  "segurança": "Information Technology",
  "seguranca": "Information Technology",
  "helpdesk": "Information Technology",
  "vendas": "Business Development",
  "comercial": "Business Development",
  "negocios": "Business Development",
  "negócios": "Business Development",
  "desenvolvimento de negocios": "Business Development",
  "desenvolvimento de negócios": "Business Development",
  "bd": "Business Development",
  "account": "Business Development",
  "key account": "Business Development",
  "cs": "Customer Success",
  "customer success": "Customer Success",
  "sucesso do cliente": "Customer Success",
  "diretoria": "General Management",
  "presidencia": "General Management",
  "presidência": "General Management",
  "ceo": "General Management",
  "coo": "General Management",
  "cfo": "General Management",
  "cto": "General Management",
  "chro": "General Management",
  "diretores": "General Management",
  "gestao": "General Management",
  "gestão": "General Management",
  "gerencia": "General Management",
  "gerência": "General Management",
  "board": "General Management",
  "engenharia": "Engineering & Technical",
  "p&d": "Engineering & Technical",
  "p e d": "Engineering & Technical",
  "pesquisa": "Engineering & Technical",
  "qualidade": "Engineering & Technical",
  "qa": "Engineering & Technical",
  "producao": "Engineering & Technical",
  "produção": "Engineering & Technical",
  "manutencao": "Engineering & Technical",
  "manutenção": "Engineering & Technical",
  "tecnico": "Engineering & Technical",
  "técnico": "Engineering & Technical",
  "bi": "Research & Analytics",
  "inteligencia": "Research & Analytics",
  "inteligência": "Research & Analytics",
  "analytics": "Research & Analytics",
  "pesquisa de mercado": "Research & Analytics",
  "produto": "Product",
  "produtos": "Product",
  "product": "Product",
  "pm": "Product",
  "ux": "Design",
  "design": "Design",
  "juridico": "Legal",
  "jurídico": "Legal",
  "legal": "Legal",
  "compliance": "Legal",
  "administrativo": "Operations",
  "administracao": "Operations",
  "administração": "Operations",
  "secretaria": "Operations",
  "saude": "Health, Safety and Security",
  "saúde": "Health, Safety and Security",
  "ssma": "Health, Safety and Security",
  "seguranca do trabalho": "Health, Safety and Security",
  "medicina": "Health, Safety and Security",
};

// ── Schema de entrada ──
const SearchSchema = z.object({
  company_name:   z.string().min(1).max(255),
  departments:    z.array(z.string().min(1).max(100)).min(1).max(10),
  company_id:     z.string().uuid().optional(),
  bitrix_card_id: z.string().optional(),
  bitrix_user_id: z.string().optional(),
  session_size:   z.number().int().min(1).max(25).default(20),
});

type SearchInput = z.infer<typeof SearchSchema>;

async function fetchLushaCookie(log: ReturnType<typeof createLogger>): Promise<{ cookie: string; token: string; cnpj: string } | null> {
  const selfHostedUrl = Deno.env.get("SUPABASE_EXTERNAL_URL") ?? "https://supabase.atomicabr.com.br";
  const selfHostedKey = Deno.env.get("SUPABASE_EXTERNAL_ANON_KEY") ?? "";

  if (!selfHostedKey) {
    log.error("cookie_fetch_missing_env", { hint: "Set SUPABASE_EXTERNAL_ANON_KEY" });
    return null;
  }

  const res = await fetch(
    `${selfHostedUrl}/rest/v1/cookies_config?servico=eq.lusha&select=cookie,token,cnpj,health_status&limit=1`,
    {
      headers: {
        "apikey": selfHostedKey,
        "Authorization": `Bearer ${selfHostedKey}`,
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!res.ok) {
    log.error("cookie_fetch_error", { status: res.status });
    return null;
  }

  const rows: Array<{ cookie: string; token: string; cnpj: string; health_status: string }> = await res.json();
  if (!rows.length) {
    log.error("cookie_not_found");
    return null;
  }

  const row = rows[0];
  if (row.health_status === "expired" || row.health_status === "error") {
    log.warn("cookie_unhealthy", { health_status: row.health_status });
  }

  return { cookie: row.cookie, token: row.token, cnpj: row.cnpj };
}

async function resolveCompanyLid(
  companyName: string,
  cookie: string,
  log: ReturnType<typeof createLogger>
): Promise<{ name: string; company_lid: string } | null> {
  const url = `https://dashboard-services.lusha.com/v2/filters/companyName?text=${encodeURIComponent(companyName)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "cookie": cookie,
        "Origin": "https://dashboard.lusha.com",
        "Referer": "https://dashboard.lusha.com/",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      log.error("lusha_company_resolve_error", { status: res.status, company: companyName });
      return null;
    }

    const data = await res.json();
    const companies: Array<{ name: string; company_lid: string }> = data?.companyName ?? data ?? [];
    return Array.isArray(companies) && companies.length > 0 ? companies[0] : null;
  } catch (err) {
    log.error("lusha_company_resolve_exception", { error: (err as Error).message });
    return null;
  }
}

async function searchContacts(
  companyInfo: { name: string; company_lid: string },
  departmentEn: string,
  cookie: string,
  sessionSize: number,
  log: ReturnType<typeof createLogger>
): Promise<Array<Record<string, unknown>>> {
  const body = {
    filters: {
      contactName: [],
      companyName: [{
        name: companyInfo.name,
        isExclude: false,
        company_lid: companyInfo.company_lid,
        domains_homepage: "",
      }],
      companyLocation: [],
      contactLocation: [],
      contactDepartment: [{ value: departmentEn, label: departmentEn, isExclude: false }],
      contactJobTitle: [],
      companyRevenue: [],
      contactExistingDataPoints: [],
      companySize: [],
      contactSeniority: [],
      companyIndustryLabels: [],
      companyLinkedinUrls: [],
      contactLinkedinUrls: [],
      companyType: [],
      companyFoundedYear: [],
      contactJobChange: [],
      previousJobTitle: [],
      previousCompanyName: [],
      companyFundingDates: [],
      companyFundingAmounts: [],
      companyFundingStages: [],
      companyFundingTypes: [],
      companyFundingIsIPO: [],
      companyKeywords: [],
    },
    filtersMetadata: {
      excludeRevealedContacts: false,
      isViewEmployeesMode: false,
      excludePartialProfiles: false,
    },
    display: "contacts",
    results_offset: { offset: 0, size: sessionSize },
    sessionId: crypto.randomUUID(),
    searchTrigger: "agents_filter_panel_draft",
    product: "agents_api",
    savedSearchId: 0,
    isSaved: false,
    pageAbove400: null,
    totalPagesAbove400: 0,
  };

  try {
    const res = await fetch("https://dashboard-services.lusha.com/api/v1/prospecting/search-agent", {
      method: "POST",
      headers: {
        "cookie": cookie,
        "Origin": "https://dashboard.lusha.com",
        "Referer": "https://dashboard.lusha.com/",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      log.error("lusha_search_error", { status: res.status, dept: departmentEn });
      return [];
    }

    const data = await res.json();
    const results = data?.contacts?.results ?? data?.results ?? [];
    log.info("lusha_search_result", {
      dept: departmentEn,
      total: data?.contacts?.total ?? 0,
      returned: results.length,
    });
    return Array.isArray(results) ? results : [];
  } catch (err) {
    log.error("lusha_search_exception", { error: (err as Error).message, dept: departmentEn });
    return [];
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const log = createLogger(requestId);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    log.warn("auth_invalid", { error: userError?.message });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let input: SearchInput;
  try {
    const body = await req.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    input = parsed.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log.info("search_start", {
    company: input.company_name,
    departments: input.departments,
    user_id: user.id,
  });

  const deptsMapped: string[] = [];
  const deptsNotFound: string[] = [];
  for (const d of input.departments) {
    const key = d.trim().toLowerCase();
    const en = DEPT_MAP[key];
    if (en) {
      if (!deptsMapped.includes(en)) deptsMapped.push(en);
    } else {
      deptsNotFound.push(d);
      log.warn("dept_unmapped", { dept: d });
    }
  }

  if (deptsMapped.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No mappable departments",
        departments_not_found: deptsNotFound,
        hint: "Check the department list: compras, marketing, rh, ti, vendas, financeiro, diretoria, engenharia, etc.",
      }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("lusha_search_sessions")
    .insert({
      user_id:              user.id,
      company_name:         input.company_name,
      company_id:           input.company_id ?? null,
      departments_requested: input.departments,
      departments_mapped:    deptsMapped,
      departments_not_found: deptsNotFound,
      bitrix_card_id:        input.bitrix_card_id ?? null,
      bitrix_user_id:        input.bitrix_user_id ?? null,
      status:               "running",
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    log.error("session_create_error", { error: sessionError?.message });
    return new Response(JSON.stringify({ error: "Failed to create search session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = session.id;
  log.info("session_created", { session_id: sessionId });

  try {
    const cookieData = await fetchLushaCookie(log);
    if (!cookieData) {
      await supabase.from("lusha_search_sessions").update({
        status: "error",
        error_message: "Lusha cookie not available or unhealthy. Check cookies_health_dashboard.",
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return new Response(
        JSON.stringify({
          error: "Lusha cookie unavailable",
          session_id: sessionId,
          hint: "Update cookie at supabase.atomicabr.com.br → cookies_config where servico=lusha",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyInfo = await resolveCompanyLid(input.company_name, cookieData.cookie, log);
    if (!companyInfo) {
      await supabase.from("lusha_search_sessions").update({
        status: "error",
        error_message: `Company "${input.company_name}" not found in Lusha. Check company name spelling.`,
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return new Response(
        JSON.stringify({
          error: "Company not found in Lusha",
          session_id: sessionId,
          company_name: input.company_name,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("lusha_search_sessions")
      .update({ lusha_company_lid: companyInfo.company_lid })
      .eq("id", sessionId);

    log.info("company_resolved", { company_lid: companyInfo.company_lid, resolved_name: companyInfo.name });

    let totalFound = 0;
    const insertedContacts: Array<Record<string, unknown>> = [];

    for (const deptEn of deptsMapped) {
      if (deptsMapped.indexOf(deptEn) > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }

      const contacts = await searchContacts(
        companyInfo,
        deptEn,
        cookieData.cookie,
        input.session_size,
        log
      );

      totalFound += contacts.length;

      const deptPt = input.departments.find(d => DEPT_MAP[d.trim().toLowerCase()] === deptEn) ?? deptEn;

      for (const contact of contacts) {
        const socialLink = (contact.social_link as string) ?? null;
        const fullName   = (contact as { name?: { full?: string } })?.name?.full ?? (contact.full_name as string) ?? "";
        const jobTitle   = (contact as { job_title?: { raw?: string } })?.job_title?.raw ?? (contact.job_title as string) ?? null;

        if (!fullName) continue;

        const { data: inserted, error: insertError } = await supabase
          .from("lusha_contacts")
          .upsert({
            user_id:           user.id,
            session_id:        sessionId,
            company_id:        input.company_id ?? null,
            lusha_company_name: companyInfo.name,
            lusha_company_lid:  companyInfo.company_lid,
            full_name:         fullName,
            job_title:         jobTitle,
            department_pt:     deptPt,
            department_en:     deptEn,
            linkedin_url:      socialLink,
            enrichment_status: "pending",
            confidence_score:  60,
            raw_lusha_payload: contact as Record<string, unknown>,
            n8n_workflow_id:   "lusha-search-edge-fn",
            n8n_execution_id:  requestId,
          }, {
            onConflict: "organization_id,linkedin_url",
            ignoreDuplicates: false,
          })
          .select("id, full_name, linkedin_url, enrichment_status")
          .maybeSingle();

        if (insertError) {
          log.warn("contact_insert_error", {
            error: insertError.message,
            name: fullName,
            linkedin: socialLink,
          });
        } else if (inserted) {
          insertedContacts.push(inserted as Record<string, unknown>);
        }
      }
    }

    await supabase.from("lusha_search_sessions").update({
      lusha_company_lid: companyInfo.company_lid,
      total_found:    totalFound,
      total_enriched: 0,
      status:         "completed",
      completed_at:   new Date().toISOString(),
    }).eq("id", sessionId);

    if (totalFound > 0) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type:    "system",
        title:   `${totalFound} decisores encontrados — ${input.company_name}`,
        message: `Lusha encontrou ${totalFound} contatos em ${deptsMapped.length} departamento(s). Prontos para enriquecimento via LeadContact.`,
        metadata: {
          session_id:  sessionId,
          company:     input.company_name,
          departments: deptsMapped,
          found:       totalFound,
        },
      });
    }

    const duration = Math.round(performance.now() - start);
    log.info("search_complete", {
      session_id:    sessionId,
      company:       input.company_name,
      total_found:   totalFound,
      departments:   deptsMapped.length,
      duration_ms:   duration,
    });

    return new Response(
      JSON.stringify({
        session_id:           sessionId,
        company_resolved:     companyInfo.name,
        company_lid:          companyInfo.company_lid,
        departments_searched: deptsMapped,
        departments_skipped:  deptsNotFound,
        total_found:          totalFound,
        contacts:             insertedContacts,
        duration_ms:          duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error("search_failed", { error: (err as Error).message, session_id: sessionId, duration_ms: duration });

    await supabase.from("lusha_search_sessions").update({
      status:        "error",
      error_message: (err as Error).message,
      completed_at:  new Date().toISOString(),
    }).eq("id", sessionId);

    return new Response(
      JSON.stringify({ error: (err as Error).message, session_id: sessionId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
