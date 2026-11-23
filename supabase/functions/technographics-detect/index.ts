// Detecção de technographics via HTML scraping.
// Detecta tecnologias usadas no site de uma empresa e registra como
// intent_signals do tipo "tech_adoption".
//
// POST { company_id: uuid, website_url?: string }
// → { detected: TechSignal[], already_known: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface TechFingerprint {
  name: string;
  category: string;
  patterns: RegExp[];
  strength: "high" | "medium" | "low";
}

const FINGERPRINTS: TechFingerprint[] = [
  { name: "WordPress", category: "CMS", strength: "high", patterns: [/wp-content\//i, /wp-includes\//i] },
  { name: "Shopify", category: "E-commerce", strength: "high", patterns: [/shopify\.com\/s\/files/i, /cdn\.shopify\.com/i] },
  { name: "Wix", category: "CMS", strength: "high", patterns: [/static\.wixstatic\.com/i] },
  { name: "Webflow", category: "CMS", strength: "high", patterns: [/webflow\.io/i, /assets\.website-files\.com/i] },
  { name: "VTEX", category: "E-commerce", strength: "high", patterns: [/vtex\.com/i, /vteximg\.com\.br/i] },
  { name: "Magento", category: "E-commerce", strength: "high", patterns: [/magento\./i, /mage\/cookies/i] },
  { name: "Google Analytics", category: "Analytics", strength: "high", patterns: [/google-analytics\.com/i, /googletagmanager\.com/i] },
  { name: "Hotjar", category: "Analytics", strength: "high", patterns: [/hotjar\.com/i] },
  { name: "Mixpanel", category: "Analytics", strength: "high", patterns: [/mixpanel\.com/i] },
  { name: "Clarity", category: "Analytics", strength: "high", patterns: [/clarity\.ms/i] },
  { name: "HubSpot", category: "CRM", strength: "high", patterns: [/hs-scripts\.com/i, /hubspot\.com/i] },
  { name: "Salesforce", category: "CRM", strength: "high", patterns: [/salesforce\.com/i, /pardot\.com/i] },
  { name: "RD Station", category: "CRM", strength: "high", patterns: [/rdstation\.com\.br/i] },
  { name: "Pipedrive", category: "CRM", strength: "medium", patterns: [/pipedrive\.com/i] },
  { name: "Zoho CRM", category: "CRM", strength: "medium", patterns: [/zoho\.com/i, /zohosalesiq/i] },
  { name: "Intercom", category: "Support", strength: "high", patterns: [/intercom\.io/i, /intercomcdn\.com/i] },
  { name: "Zendesk", category: "Support", strength: "high", patterns: [/zendesk\.com/i] },
  { name: "Drift", category: "Support", strength: "high", patterns: [/drift\.com/i, /js\.driftt\.com/i] },
  { name: "Crisp", category: "Support", strength: "high", patterns: [/crisp\.chat/i] },
  { name: "Mailchimp", category: "Email", strength: "high", patterns: [/mailchimp\.com/i, /chimpstatic\.com/i] },
  { name: "Klaviyo", category: "Email", strength: "high", patterns: [/klaviyo\.com/i] },
  { name: "ActiveCampaign", category: "Email", strength: "high", patterns: [/activecampaign\.com/i] },
  { name: "Brevo", category: "Email", strength: "high", patterns: [/brevo\.com/i, /sendinblue\.com/i] },
  { name: "Facebook Pixel", category: "Advertising", strength: "high", patterns: [/connect\.facebook\.net/i, /fbevents\.js/i] },
  { name: "Google Ads", category: "Advertising", strength: "high", patterns: [/googleadservices\.com/i, /googlesyndication\.com/i] },
  { name: "LinkedIn Insight", category: "Advertising", strength: "high", patterns: [/snap\.licdn\.com/i] },
  { name: "TikTok Pixel", category: "Advertising", strength: "high", patterns: [/analytics\.tiktok\.com/i] },
  { name: "Next.js", category: "Frontend", strength: "high", patterns: [/__NEXT_DATA__/i, /\/_next\/static/i] },
  { name: "Nuxt.js", category: "Frontend", strength: "high", patterns: [/__NUXT/i, /\/_nuxt\//i] },
  { name: "React", category: "Frontend", strength: "medium", patterns: [/react\.production\.min\.js/i] },
  { name: "Vue.js", category: "Frontend", strength: "medium", patterns: [/vue\.min\.js/i, /vue\.runtime/i] },
  { name: "Angular", category: "Frontend", strength: "medium", patterns: [/ng-version/i] },
  { name: "Cloudflare", category: "CDN/Security", strength: "medium", patterns: [/cloudflare\.com/i, /__cf_bm/i] },
  { name: "Vercel", category: "Hosting", strength: "medium", patterns: [/_vercel\//i] },
  { name: "Stripe", category: "Payments", strength: "high", patterns: [/js\.stripe\.com/i] },
  { name: "Mercado Pago", category: "Payments", strength: "high", patterns: [/mercadopago\.com/i, /mlstatic\.com/i] },
  { name: "PagSeguro", category: "Payments", strength: "high", patterns: [/pagseguro\.uol\.com\.br/i] },
  { name: "Typeform", category: "Forms", strength: "high", patterns: [/typeform\.com/i] },
  { name: "Calendly", category: "Scheduling", strength: "high", patterns: [/calendly\.com/i] },
  { name: "Tailwind CSS", category: "CSS", strength: "medium", patterns: [/tailwindcss/i] },
  { name: "Bootstrap", category: "CSS", strength: "medium", patterns: [/bootstrap\.min\.css/i] },
  { name: "jQuery", category: "JS Library", strength: "low", patterns: [/jquery\.min\.js/i] },
];

function detectTechnologies(html: string): TechFingerprint[] {
  return FINGERPRINTS.filter(fp => fp.patterns.some(pat => pat.test(html)));
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) url = "https://" + url;
  try { return new URL(url).href; } catch { return url; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "Unauthorized" });

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return json(401, { error: "Unauthorized" });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: { company_id?: string; website_url?: string };
  try { body = await req.json(); } catch { return json(400, { error: "JSON invalido" }); }

  const { company_id, website_url } = body;
  if (!company_id) return json(400, { error: "company_id obrigatorio" });

  const { data: member } = await adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member) return json(403, { error: "Sem org ativa" });
  const org_id = member.organization_id;

  let siteUrl = website_url;
  if (!siteUrl) {
    const { data: company } = await adminClient
      .from("companies")
      .select("website")
      .eq("id", company_id)
      .single();
    siteUrl = company?.website ?? null;
  }

  if (!siteUrl) return json(400, { error: "URL do site nao encontrada. Informe website_url." });
  siteUrl = normalizeUrl(siteUrl);

  let html = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const resp = await fetch(siteUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LUX-Technographics/1.0)", "Accept": "text/html" },
      redirect: "follow",
    });
    clearTimeout(timer);
    html = await resp.text();
  } catch (err) {
    return json(502, { error: `Falha ao acessar ${siteUrl}: ${(err as Error).message}` });
  }

  const detected = detectTechnologies(html);
  if (detected.length === 0) return json(200, { detected: [], already_known: 0 });

  const { data: company } = await adminClient.from("companies").select("name").eq("id", company_id).single();
  const company_name = company?.name ?? "Empresa";

  const { data: existing } = await adminClient
    .from("intent_signals")
    .select("signal")
    .eq("company_id", company_id)
    .eq("type", "tech_adoption")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  const knownSignals = new Set((existing ?? []).map((e: { signal: string }) => e.signal));
  const newDetections = detected.filter(d => !knownSignals.has(d.name));

  if (newDetections.length === 0) return json(200, { detected: [], already_known: detected.length });

  const rows = newDetections.map(d => ({
    user_id: user.id,
    organization_id: org_id,
    company_id,
    company_name,
    type: "tech_adoption",
    signal: d.name,
    strength: d.strength,
    details: `Categoria: ${d.category} · detectado em ${siteUrl}`,
    metadata: { category: d.category, source_url: siteUrl, detected_at: new Date().toISOString() },
  }));

  const { error: insertErr } = await adminClient.from("intent_signals").insert(rows);
  if (insertErr) return json(500, { error: insertErr.message });

  return json(200, {
    detected: newDetections.map(d => ({ name: d.name, category: d.category, strength: d.strength })),
    already_known: knownSignals.size,
  });
});