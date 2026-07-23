// Enriquecimento de empresa via CNPJá.
// - Usa endpoint autenticado (api.cnpja.com) se o secret CNPJA_API_KEY estiver
//   configurado; caso contrário, usa endpoint público (open.cnpja.com), com
//   rate-limit menor.
// - Requer JWT válido (auth do usuário).
//
// POST body: { cnpj: string }
// Resposta: { source: "cnpja"|"cnpja_open"; data: NormalizedCompany; trace_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CNPJA_API_KEY = Deno.env.get("CNPJA_API_KEY");

const BodySchema = z.object({
  cnpj: z.string().min(11).max(20),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(v: string): string {
  return v.replace(/\D+/g, "");
}

// Validação matemática do CNPJ (algoritmo dos dígitos verificadores).
function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

interface CnpjaAddress {
  street?: string;
  number?: string;
  details?: string;
  district?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: { name?: string };
}
interface CnpjaResponse {
  taxId?: string;
  company?: {
    name?: string;
    equity?: number;
    size?: { text?: string };
    members?: Array<{
      person?: { name?: string; taxId?: string };
      role?: { text?: string };
      since?: string;
    }>;
  };
  alias?: string;
  founded?: string;
  status?: { text?: string };
  address?: CnpjaAddress;
  phones?: Array<{ area?: string; number?: string }>;
  emails?: Array<{ address?: string }>;
  mainActivity?: { id?: number; text?: string };
  sideActivities?: Array<{ id?: number; text?: string }>;
}

function formatPhone(p?: { area?: string; number?: string }): string | null {
  if (!p?.number) return null;
  const area = p.area ?? "";
  const num = p.number;
  if (num.length === 9) return `(${area}) ${num.slice(0, 5)}-${num.slice(5)}`;
  if (num.length === 8) return `(${area}) ${num.slice(0, 4)}-${num.slice(4)}`;
  return `(${area}) ${num}`;
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCnaeCode(id?: number): string | null {
  if (!id) return null;
  const s = String(id).padStart(7, "0");
  // 7 dígitos → 0000-0/00
  return `${s.slice(0, 4)}-${s.slice(4, 5)}/${s.slice(5)}`;
}

function normalize(raw: CnpjaResponse, cnpjClean: string) {
  const addr = raw.address ?? {};
  const locationParts = [addr.city, addr.state].filter(Boolean);
  const fullAddress = [
    addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ""}`,
    addr.details,
    addr.district,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city || addr.state,
    addr.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const members = (raw.company?.members ?? [])
    .map((m) => ({
      name: m.person?.name ?? null,
      role: m.role?.text ?? null,
      since: m.since ?? null,
    }))
    .filter((m) => m.name);

  return {
    cnpj: formatCnpj(cnpjClean),
    name: raw.company?.name ?? null,
    alias: raw.alias ?? null,
    founded: raw.founded ?? null,
    status: raw.status?.text ?? null,
    equity: raw.company?.equity ?? null,
    size: raw.company?.size?.text ?? null,
    sector: raw.mainActivity?.text ?? null,
    cnae_code: formatCnaeCode(raw.mainActivity?.id),
    cnae_text: raw.mainActivity?.text ?? null,
    activities: (raw.sideActivities ?? [])
      .map((a) => a.text)
      .filter((t): t is string => !!t),
    activities_full: (raw.sideActivities ?? [])
      .map((a) => ({ code: formatCnaeCode(a.id), text: a.text ?? null }))
      .filter((a) => a.code || a.text),
    members,
    location: locationParts.join(" - ") || null,
    address: fullAddress || null,
    zip: addr.zip ?? null,
    phone: formatPhone(raw.phones?.[0]),
    email: raw.emails?.[0]?.address ?? null,
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const traceId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing_auth", trace_id: traceId });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json(401, { error: "invalid_auth", trace_id: traceId });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(400, { error: "invalid_body", details: parsed.error.flatten(), trace_id: traceId });
    }

    const cnpjClean = onlyDigits(parsed.data.cnpj);
    if (!isValidCnpj(cnpjClean)) {
      return json(400, { error: "invalid_cnpj", trace_id: traceId });
    }

    const useAuth = !!CNPJA_API_KEY;
    const url = useAuth
      ? `https://api.cnpja.com/office/${cnpjClean}`
      : `https://open.cnpja.com/office/${cnpjClean}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: useAuth
          ? { Authorization: CNPJA_API_KEY!, Accept: "application/json" }
          : { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 404) {
      return json(404, { error: "cnpj_not_found", trace_id: traceId });
    }
    if (res.status === 429) {
      return json(429, { error: "rate_limited", hint: "Configure CNPJA_API_KEY para maior throughput.", trace_id: traceId });
    }
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error(JSON.stringify({ level: "error", trace_id: traceId, status: res.status, details }));
      return json(res.status, { error: "provider_error", status: res.status, trace_id: traceId });
    }

    const raw = (await res.json()) as CnpjaResponse;
    const data = normalize(raw, cnpjClean);

    return json(200, {
      source: useAuth ? "cnpja" : "cnpja_open",
      data,
      trace_id: traceId,
    });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", trace_id: traceId, err: (err as Error).message }));
    return json(500, { error: "internal_error", trace_id: traceId });
  }
});
