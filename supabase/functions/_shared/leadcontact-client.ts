// ============================================================================
// _shared/leadcontact-client.ts
// Wrapper LeadContact (findEmailAll + findPhone). Autenticado via SESSION cookie.
// ============================================================================
import { extractLeadContactSession, getCookie } from "./cookies.ts";
import { normalizePhoneBR, type NormalizedPhone } from "./phone-br.ts";

const BASE = "https://leadcontact.co/api";

const HEADERS_BASE = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

export class LeadContactError extends Error {
  constructor(message: string, public readonly status?: number, public readonly transient = false) {
    super(message);
    this.name = "LeadContactError";
  }
}

async function sessionHeader(): Promise<Record<string, string>> {
  const { cookie } = await getCookie("leadcontact");
  const value = extractLeadContactSession(cookie);
  return { Cookie: `SESSION=${value}` };
}

export interface FoundEmail {
  email: string;
  type?: string;
  verified?: boolean;
  source?: string;
}

export async function findEmailAll(linkedinUrl: string): Promise<{ emails: FoundEmail[]; raw: unknown }> {
  const headers = { ...HEADERS_BASE, ...(await sessionHeader()) };
  const res = await fetch(`${BASE}/findEmailAll`, {
    method: "POST",
    headers,
    body: JSON.stringify({ linkedin_url: linkedinUrl }),
    signal: AbortSignal.timeout(20000),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new LeadContactError(
      `leadcontact email ${res.status}: ${bodyText.slice(0, 200)}`,
      res.status,
      res.status === 429 || res.status >= 500,
    );
  }
  let json: unknown;
  try { json = JSON.parse(bodyText); } catch { json = { raw: bodyText }; }
  const emails: FoundEmail[] = [];
  const data = (json as { emails?: unknown[]; data?: { emails?: unknown[] } });
  const list = (data.emails ?? data.data?.emails ?? []) as Array<Record<string, unknown>>;
  for (const item of list) {
    const email = typeof item.email === "string" ? item.email : typeof item.value === "string" ? item.value : null;
    if (!email) continue;
    emails.push({
      email: email.toLowerCase().trim(),
      type: typeof item.type === "string" ? item.type : undefined,
      verified: item.verified === true,
      source: typeof item.source === "string" ? item.source : "leadcontact",
    });
  }
  return { emails, raw: json };
}

export interface FoundPhone {
  raw: string;
  normalized: NormalizedPhone;
  type?: string;
  source?: string;
}

export async function findPhone(linkedinUrl: string): Promise<{ phones: FoundPhone[]; raw: unknown }> {
  const headers = { ...HEADERS_BASE, ...(await sessionHeader()) };
  const res = await fetch(`${BASE}/findPhone`, {
    method: "POST",
    headers,
    body: JSON.stringify({ linkedin_url: linkedinUrl }),
    signal: AbortSignal.timeout(20000),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new LeadContactError(
      `leadcontact phone ${res.status}: ${bodyText.slice(0, 200)}`,
      res.status,
      res.status === 429 || res.status >= 500,
    );
  }
  let json: unknown;
  try { json = JSON.parse(bodyText); } catch { json = { raw: bodyText }; }
  const data = (json as { phones?: unknown[]; data?: { phones?: unknown[] } });
  const list = (data.phones ?? data.data?.phones ?? []) as Array<Record<string, unknown>>;
  const phones: FoundPhone[] = [];
  for (const item of list) {
    const raw = typeof item.phone === "string" ? item.phone
      : typeof item.number === "string" ? item.number
      : typeof item.value === "string" ? item.value
      : null;
    if (!raw) continue;
    phones.push({
      raw,
      normalized: normalizePhoneBR(raw),
      type: typeof item.type === "string" ? item.type : undefined,
      source: typeof item.source === "string" ? item.source : "leadcontact",
    });
  }
  return { phones, raw: json };
}
