// ============================================================================
// _shared/leadcontact-client.ts
// Contrato REAL, extraído dos nós do n8n em produção.
// A API imita a extensão de Chrome do LeadContact:
//  1. Host é api.leadcontact.ai/api/contact (NÃO leadcontact.co)
//  2. findEmailAll usa o cookie do LEADCONTACT;
//     findPhone usa o cookie do LINKEDIN + csrfToken no body
//  3. header `origin: chrome-extension://imhlnhlbiencamnbpigopiibddajimep` é obrigatório
//  4. resposta útil vem em data.sources[]
// ============================================================================
import { extractLinkedInCsrfToken, getCookie, markCookieUnhealthy } from "./cookies.ts";
import { normalizePhoneBR, type NormalizedPhone } from "./phone-br.ts";
import { publicIdFromLinkedInUrl } from "./linkedin-url.ts";
export { publicIdFromLinkedInUrl };

const BASE = "https://api.leadcontact.ai/api/contact";
const EXT_ORIGIN = "chrome-extension://imhlnhlbiencamnbpigopiibddajimep";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

export class LeadContactError extends Error {
  constructor(message: string, public readonly status?: number, public readonly transient = false) {
    super(message);
    this.name = "LeadContactError";
  }
}


function envelope(publicId: string): Record<string, unknown> {
  return {
    userAgent: UA,
    locale: "pt-BR",
    extId: "",
    version: "2.1.1",
    syncScene: 1,
    displayPictureUrl: "",
    profileId: "",
    publicId,
    firstName: "",
    lastName: "",
    summary: "",
    geoCountryName: "",
    geoLocationName: "",
    headline: "",
    industry: "",
    company: "",
    companyUniversalName: "",
    jobTitle: "",
    companyUrn: "",
    skills: ["Management"],
    trigger: "CHAT",
    messageId: "",
    requestTime: 0,
    pollIndex: 0,
    scene: "LinkedIn-Sidepanel",
  };
}

/**
 * A API do LeadContact devolve HTTP 200 mesmo em erro de negócio.
 * Comprovado por chamada real em 16/07/2026:
 *   HTTP 200 {"code":4010001,"msg":"Not login or login expired"}
 * Sem esta checagem o erro passa como sucesso, extractSources() devolve [],
 * e todo contato vira not_found em silêncio — com a sessão morta.
 */
export function assertLeadContactOk(path: string, json: unknown): void {
  const j = json as { code?: unknown; msg?: unknown };
  const code = typeof j?.code === "number" ? j.code : null;
  // Sem `code` (ou code de sucesso) → resposta boa, segue o baile.
  if (code === null || code === 0 || code === 200) return;

  const msg = typeof j?.msg === "string" ? j.msg : "erro desconhecido";
  const s = String(code);
  const isAuth = s.startsWith("401") || s.startsWith("403");
  const isRate = s.startsWith("429");
  throw new LeadContactError(
    `leadcontact ${path}: code ${code} — ${msg}`,
    isAuth ? 401 : isRate ? 429 : 400,
    isRate,
  );
}

async function postLeadContact(
  path: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      cookie,
      origin: EXT_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new LeadContactError(
      `leadcontact ${path} ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      res.status === 429 || res.status >= 500,
    );
  }
  try {
    const parsed = JSON.parse(text);
    assertLeadContactOk(path, parsed);
    return parsed;
  } catch (e) {
    if (e instanceof LeadContactError) throw e; // não engolir o nosso próprio erro
    return { raw: text };
  }
}

function extractSources(json: unknown): Array<Record<string, unknown>> {
  const j = json as { data?: { sources?: unknown }; sources?: unknown };
  const s = j?.data?.sources ?? j?.sources;
  return Array.isArray(s) ? (s as Array<Record<string, unknown>>) : [];
}

export interface FoundEmail {
  email: string;
  type?: string;
  verified?: boolean;
  source: "leadcontact";
}

export async function findEmailAll(linkedinUrl: string): Promise<{ emails: FoundEmail[]; raw: unknown }> {
  const { cookie } = await getCookie("leadcontact");
  const publicId = publicIdFromLinkedInUrl(linkedinUrl);
  if (!publicId) throw new LeadContactError("linkedin_url sem publicId utilizável");

  const json = await postLeadContact("findEmailAll", cookie, envelope(publicId));

  const emails: FoundEmail[] = [];
  for (const s of extractSources(json)) {
    const raw = typeof s.email === "string" ? s.email : null;
    if (!raw || !raw.includes("@")) continue;
    const email = raw.toLowerCase().trim();
    if (emails.some((e) => e.email === email)) continue;
    emails.push({
      email,
      type: typeof s.type === "string" ? s.type : undefined,
      verified: s.verified === true || s.status === "verified",
      source: "leadcontact",
    });
  }
  return { emails, raw: json };
}

export interface FoundPhone {
  raw: string;
  normalized: NormalizedPhone;
  type?: string;
  source: "leadcontact";
}

export async function findPhone(linkedinUrl: string): Promise<{ phones: FoundPhone[]; raw: unknown }> {
  const { cookie: linkedinCookie } = await getCookie("linkedin");
  const csrfToken = extractLinkedInCsrfToken(linkedinCookie);
  if (!csrfToken) throw new LeadContactError("cookie linkedin sem JSESSIONID (csrfToken)");

  const publicId = publicIdFromLinkedInUrl(linkedinUrl);
  if (!publicId) throw new LeadContactError("linkedin_url sem publicId utilizável");

  const body = {
    ...envelope(publicId),
    emails: [],
    email: "",
    cookie: linkedinCookie,
    csrfToken,
  };

  const json = await postLeadContact("findPhone", linkedinCookie, body);

  const phones: FoundPhone[] = [];
  for (const s of extractSources(json)) {
    const raw = typeof s.phone === "string" ? s.phone
      : typeof s.number === "string" ? s.number
      : null;
    if (!raw) continue;
    if (phones.some((p) => p.raw === raw)) continue;
    phones.push({
      raw,
      normalized: normalizePhoneBR(raw),
      type: typeof s.type === "string" ? s.type : undefined,
      source: "leadcontact",
    });
  }
  return { phones, raw: json };
}
