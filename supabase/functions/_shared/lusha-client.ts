// ============================================================================
// _shared/lusha-client.ts
// Wrapper dos endpoints DASHBOARD da Lusha — NÃO consomem crédito.
//
// ⚠️ CONTRATO EXTRAÍDO DO n8n VIVO (workflow ZRnakqmCSpGub7Wu, 17/07/2026),
//    não da documentação e não de suposição. A versão anterior deste arquivo
//    estava errada em 7 de 7 pontos (método, transporte, path, body, parsing,
//    nomes de campo e formato do cookie). Não "melhore" nada aqui sem antes
//    conferir contra o n8n ou contra uma chamada real.
//
//   • GET  https://dashboard-services.lusha.com/v2/filters/companyName?text=
//         -> { companyName: [ { name, company_lid, ... } ] }
//   • POST https://dashboard-services.lusha.com/api/v1/prospecting/search-agent
//         -> { contacts: { total: number, results: [...] } }
//
// Autenticação: cookie `ll` do vault (serviço "lusha").
// ============================================================================
import { getCookie } from "./cookies.ts";
import { assertValidDepartments } from "./lusha-departments.ts";

const LUSHA_COMPANY_URL = "https://dashboard-services.lusha.com/v2/filters/companyName";
const LUSHA_SEARCH_URL = "https://dashboard-services.lusha.com/api/v1/prospecting/search-agent";

const COMMON_HEADERS: Record<string, string> = {
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://dashboard.lusha.com",
  "Referer": "https://dashboard.lusha.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// ────────────────────────────────────────────────────────────────────────────
// Erros
// ────────────────────────────────────────────────────────────────────────────
export interface LushaError extends Error {
  status?: number;
  transient: boolean;
}

export function makeLushaError(msg: string, status?: number): LushaError {
  const err = new Error(msg) as LushaError;
  err.status = status;
  err.transient = status === 429 || (status !== undefined && status >= 500);
  return err;
}

// ────────────────────────────────────────────────────────────────────────────
// Cookie — normalização e diagnóstico
// ────────────────────────────────────────────────────────────────────────────

/**
 * O vault guarda o cookie de formas diferentes por serviço:
 *   linkedin/leadcontact -> string completa: "a=1; b=2; ..."
 *   lusha (até 17/07/26) -> JWT CRU, sem nome  <- ERRADO
 *
 * Provado por chamada real em 17/07/2026:
 *   cookie: <jwt cru>  -> 401 {"message":"Unauthorized"}                (servidor IGNORA)
 *   cookie: ll=<jwt>   -> 401 {"message":"No credentials found for given 'iss'"}
 *                                                                       (servidor LÊ)
 * A segunda resposta prova que o nome do cookie é `ll`. O n8n manda cru e por
 * isso a perna da Lusha nunca autenticou.
 */
export function normalizeLushaCookie(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  if (!v) throw makeLushaError("cookie lusha ausente/vazio no vault", 401);

  // Já vem como cookie string ("ll=...", "_ga=...; ll=...") — usa como está.
  if (/^[A-Za-z_][A-Za-z0-9_.-]*=/.test(v)) return v;

  // JWT cru — nomeia como `ll`.
  if (/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(v)) return `ll=${v}`;

  throw makeLushaError(
    "cookie lusha em formato irreconhecível — esperado 'll=<jwt>' ou a string completa do DevTools",
    401,
  );
}

export interface LushaTokenInfo {
  present: boolean;
  sub?: string;
  exp?: number;
  anonymous: boolean;
  expired: boolean;
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

/** Lê o JWT `ll` sem chamar a rede. Best-effort: nunca lança. */
export function inspectLushaToken(cookie: string, now: number = Date.now()): LushaTokenInfo {
  const m = String(cookie ?? "").match(/(?:^|;\s*)ll=([^;]+)/);
  if (!m) return { present: false, anonymous: false, expired: false };
  const parts = m[1].split(".");
  if (parts.length !== 3) return { present: true, anonymous: false, expired: false };
  try {
    const p = JSON.parse(b64urlDecode(parts[1])) as { sub?: string; exp?: number };
    return {
      present: true,
      sub: p.sub,
      exp: p.exp,
      anonymous: p.sub === "anonymous",
      expired: typeof p.exp === "number" && p.exp * 1000 < now,
    };
  } catch {
    return { present: true, anonymous: false, expired: false };
  }
}

/**
 * Falha rápido ANTES da chamada de rede — mas só no que dá para provar offline.
 *
 * ⚠️ NÃO checa `sub === "anonymous"`. Provado em 17/07/2026 que token anônimo
 * FUNCIONA: o cookie `ll` do dashboard tem sub:"anonymous" e trouxe HTTP 201 com
 * 6.970 contatos. O servidor amarra o `iss` (uuid do visitante) à sessão logada
 * do lado dele — a anonimidade do payload não diz nada sobre a validade.
 *
 * O modo real de morte é o `iss` expirar NO SERVIDOR antes do `exp` do JWT, e
 * isso é INDETECTÁVEL offline: só aparece como 401 "No credentials found for
 * given 'iss'". Não invente guarda para isso aqui — trate no erro da chamada.
 */
export function assertLushaSessionToken(cookie: string, now: number = Date.now()): void {
  const info = inspectLushaToken(cookie, now);
  if (info.expired) {
    throw makeLushaError(
      "cookie lusha EXPIRADO (exp no passado) — recapture o `ll` em dashboard.lusha.com (F12 > Application > Cookies).",
      401,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Erro de negócio com HTTP 200 — a armadilha-mãe deste projeto
// ────────────────────────────────────────────────────────────────────────────
export function assertLushaOk(op: string, json: unknown): void {
  if (!json || typeof json !== "object") return;
  const j = json as Record<string, unknown>;
  const msg = typeof j.message === "string" ? j.message : undefined;
  if (msg && /unauthor|no credentials|forbidden|expired|invalid token/i.test(msg)) {
    throw makeLushaError(`lusha ${op}: ${msg}`, 401);
  }
  if (typeof j.error === "string" && j.error) {
    throw makeLushaError(`lusha ${op}: ${j.error}`, 400);
  }
}

async function readJson(res: Response, op: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) throw makeLushaError(`lusha ${op} HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw makeLushaError(`lusha ${op}: resposta não-JSON: ${text.slice(0, 160)}`, res.status);
  }
  assertLushaOk(op, json); // HTTP 200 + erro no corpo
  return json;
}

async function lushaCookieHeader(): Promise<string> {
  const { cookie } = await getCookie("lusha");
  const normalized = normalizeLushaCookie(cookie);
  assertLushaSessionToken(normalized);
  return normalized;
}

// ────────────────────────────────────────────────────────────────────────────
// 1) Company lookup  —  GET /v2/filters/companyName?text=
// ────────────────────────────────────────────────────────────────────────────
export interface LushaCompanyMatch {
  name: string;
  companyLid: string | number;
  raw: unknown;
}

/** Aceita o shape real do n8n: { companyName: [...] }. */
export function parseCompanyMatches(json: unknown): LushaCompanyMatch[] {
  const rows = (json as { companyName?: unknown })?.companyName;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      name: typeof r.name === "string" ? r.name : "",
      companyLid: (r.company_lid ?? r.companyLid ?? "") as string | number,
      raw: r,
    }))
    .filter((c) => c.name !== "" && c.companyLid !== "");
}

/**
 * Limpeza do nome da empresa — cópia do nó "Variaveis" do n8n:
 * corta em "-", descarta pedaços com "/" ou só-dígitos, pega os 2 primeiros.
 *   "LACTALIS - 123 - SP/SP" -> "LACTALIS"
 */
export function cleanCompanyName(raw: string): string {
  return String(raw ?? "")
    .split("-")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.includes("/") && !/^\d+$/.test(p))
    .slice(0, 2)
    .join(" ")
    .trim();
}

export async function searchCompanyByName(name: string): Promise<LushaCompanyMatch[]> {
  const cookie = await lushaCookieHeader();
  const url = `${LUSHA_COMPANY_URL}?text=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: "GET", // <- era POST. Provado GET pelo n8n.
    headers: { ...COMMON_HEADERS, cookie },
    signal: AbortSignal.timeout(15000),
  });
  return parseCompanyMatches(await readJson(res, "companyName"));
}

// ────────────────────────────────────────────────────────────────────────────
// 2) Search agent  —  POST /api/v1/prospecting/search-agent
// ────────────────────────────────────────────────────────────────────────────
export interface SearchAgentInput {
  companyName: string;
  companyLid: string | number;
  departmentEn: string; // enum Lusha já traduzido
  offset?: number;
  size?: number;
  sessionId?: string;
}

export function newSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Envelope de 24 filtros. A Lusha rejeita/ignora silenciosamente se faltar
 * chave — o n8n manda TODAS, inclusive as vazias. Mantenha assim.
 */
export function buildSearchAgentBody(input: SearchAgentInput): Record<string, unknown> {
  const dep = input.departmentEn;
  return {
    filters: {
      contactName: [],
      companyName: [
        { name: input.companyName, isExclude: false, company_lid: input.companyLid, domains_homepage: "" },
      ],
      companyLocation: [],
      contactLocation: [],
      contactDepartment: [{ value: dep, label: dep, isExclude: false }],
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
    results_offset: { offset: input.offset ?? 0, size: input.size ?? 25 },
    sessionId: input.sessionId ?? newSessionId(),
    searchTrigger: "agents_filter_panel_draft",
    product: "agents_api",
    savedSearchId: 0,
    isSaved: false,
    pageAbove400: null,
    totalPagesAbove400: 0,
  };
}

// ── Shape REAL do resultado (aninhado, snake_case) ──────────────────────────
// item.name.full · item.job_title.raw · item.social_link
// item.emails[] = { address, status:"masked"|... } · item.phones[] = { phone|number }
// item.previous_job.emails[] = string[]
export interface LushaSearchContact {
  fullName: string;
  jobTitle: string;
  linkedinUrl: string;
  department: string;
  hasRevealedEmail: boolean;
  hasPhone: boolean;
  raw: Record<string, unknown>;
}

export interface LushaSearchResult {
  total: number;
  contacts: LushaSearchContact[];
}

function pickStr(o: unknown, ...path: string[]): string {
  let cur: unknown = o;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : "";
}

/** Um e-mail "revelado" é o que NÃO está mascarado. Cópia do n8n. */
export function findRevealedEmail(item: Record<string, unknown>): string {
  const emails = item?.emails;
  if (Array.isArray(emails)) {
    const hit = emails.find(
      (e) =>
        !!e && typeof e === "object" &&
        (e as Record<string, unknown>).status !== "masked" &&
        typeof (e as Record<string, unknown>).address === "string" &&
        !((e as Record<string, unknown>).address as string).includes("..."),
    );
    if (hit) return (hit as Record<string, unknown>).address as string;
  }
  const prev = (item?.previous_job as { emails?: unknown })?.emails;
  if (Array.isArray(prev) && typeof prev[0] === "string" && prev[0]) return prev[0];
  return "";
}

/** Primeiro telefone do payload da Lusha. Aceita `.phone` e `.number`. */
export function findPayloadPhone(item: Record<string, unknown>): string {
  const phones = item?.phones;
  if (!Array.isArray(phones) || phones.length === 0) return "";
  const p = phones[0] as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return "";
  return (typeof p.phone === "string" && p.phone) || (typeof p.number === "string" && p.number) || "";
}

export function normalizeSearchContact(
  item: Record<string, unknown>,
  departmentEn: string,
): LushaSearchContact {
  return {
    fullName: pickStr(item, "name", "full"),
    jobTitle: pickStr(item, "job_title", "raw"),
    linkedinUrl: pickStr(item, "social_link"),
    department: departmentEn,
    hasRevealedEmail: findRevealedEmail(item) !== "",
    hasPhone: findPayloadPhone(item) !== "",
    raw: item,
  };
}

/** Aceita o shape real: { contacts: { total, results[] } }. */
export function parseSearchAgent(json: unknown, departmentEn: string): LushaSearchResult {
  const c = (json as { contacts?: { total?: unknown; results?: unknown } })?.contacts;
  const results = Array.isArray(c?.results) ? c!.results : [];
  return {
    total: typeof c?.total === "number" ? c.total : 0,
    contacts: results
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => normalizeSearchContact(r, departmentEn)),
  };
}

export async function searchDecisors(input: SearchAgentInput): Promise<LushaSearchResult> {
  const cookie = await lushaCookieHeader();
  const res = await fetch(LUSHA_SEARCH_URL, {
    method: "POST",
    headers: { ...COMMON_HEADERS, "Content-Type": "application/json", cookie },
    body: JSON.stringify(buildSearchAgentBody(input)),
    signal: AbortSignal.timeout(20000),
  });
  return parseSearchAgent(await readJson(res, "search-agent"), input.departmentEn);
}
