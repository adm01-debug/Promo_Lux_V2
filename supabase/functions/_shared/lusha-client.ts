// ============================================================================
// _shared/lusha-client.ts
// Wrapper dos endpoints DASHBOARD da Lusha (não consomem crédito):
//   • POST https://dashboard-services.lusha.com/v2/filters/companyName
//   • POST https://dashboard-services.lusha.com/v2/search-agent
// Autenticado via cookie `ll` do vault (paridade com n8n).
// ============================================================================
import { getCookie } from "./cookies.ts";

const LUSHA_COMPANY_URL = "https://dashboard-services.lusha.com/v2/filters/companyName";
const LUSHA_SEARCH_URL = "https://dashboard-services.lusha.com/v2/search-agent";

const COMMON_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://dashboard.lusha.com",
  "Referer": "https://dashboard.lusha.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

export interface LushaCompanyMatch {
  id: string | number;
  name: string;
  domain?: string;
  logoUrl?: string;
  employeesRange?: string;
  location?: string;
}

export interface LushaSearchContact {
  contactId?: string | number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  seniority?: string;
  linkedinUrl?: string;
  linkedinPublicId?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  companyName?: string;
  companyId?: string | number;
  raw: unknown;
}

export interface LushaError extends Error {
  status?: number;
  transient: boolean;
}

function makeError(msg: string, status?: number): LushaError {
  const err = new Error(msg) as LushaError;
  err.status = status;
  err.transient = status === 429 || (status !== undefined && status >= 500);
  return err;
}

/** Busca empresas por nome. Retorna até `limit` matches. */
export async function searchCompanyByName(name: string, limit = 5): Promise<LushaCompanyMatch[]> {
  const { cookie } = await getCookie("lusha");
  const res = await fetch(LUSHA_COMPANY_URL, {
    method: "POST",
    headers: { ...COMMON_HEADERS, Cookie: cookie },
    body: JSON.stringify({ text: name, limit }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw makeError(`lusha company ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const json = await res.json() as {
    data?: Array<{
      id: string | number;
      name: string;
      domain?: string;
      logoUrl?: string;
      employeesRange?: string;
      location?: string;
    }>;
  };
  return (json.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    logoUrl: c.logoUrl,
    employeesRange: c.employeesRange,
    location: c.location,
  }));
}

export interface SearchDecisorsInput {
  companyId: string | number;
  companyName: string;
  department: string; // enum Lusha EN
  page?: number;
  size?: number;
}

/** Busca contatos filtrados por empresa + departamento (endpoint dashboard). */
export async function searchDecisors(input: SearchDecisorsInput): Promise<LushaSearchContact[]> {
  const { cookie } = await getCookie("lusha");
  const body = {
    filters: {
      companies: {
        include: {
          companies: [{ id: input.companyId, name: input.companyName }],
        },
      },
      contacts: {
        include: {
          departments: [input.department],
        },
      },
    },
    pagination: {
      page: input.page ?? 1,
      size: input.size ?? 25,
    },
  };

  const res = await fetch(LUSHA_SEARCH_URL, {
    method: "POST",
    headers: { ...COMMON_HEADERS, Cookie: cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw makeError(`lusha search ${res.status}: ${errBody.slice(0, 200)}`, res.status);
  }
  const json = await res.json() as {
    contacts?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  };
  const rows = json.contacts ?? json.data ?? [];
  return rows.map((c) => normalizeContact(c, input));
}

function normalizeContact(c: Record<string, unknown>, ctx: SearchDecisorsInput): LushaSearchContact {
  const getStr = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : undefined);
  const linkedinUrl = getStr("linkedinUrl") ?? getStr("linkedin_url");
  const linkedinPublicId =
    getStr("linkedinPublicId") ??
    (linkedinUrl ? linkedinUrl.replace(/^.*linkedin\.com\/in\//, "").replace(/\/$/, "") : undefined);
  return {
    contactId: (c["contactId"] ?? c["id"]) as string | number | undefined,
    fullName: (getStr("fullName") ?? `${getStr("firstName") ?? ""} ${getStr("lastName") ?? ""}`).trim(),
    firstName: getStr("firstName"),
    lastName: getStr("lastName"),
    jobTitle: getStr("jobTitle") ?? getStr("title"),
    department: getStr("department") ?? ctx.department,
    seniority: getStr("seniority"),
    linkedinUrl,
    linkedinPublicId,
    hasEmail: c["hasEmail"] === true,
    hasPhone: c["hasPhone"] === true,
    companyName: getStr("companyName") ?? ctx.companyName,
    companyId: (c["companyId"] ?? ctx.companyId) as string | number,
    raw: c,
  };
}
