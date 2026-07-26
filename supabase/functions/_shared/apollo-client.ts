// ============================================================================
// _shared/apollo-client.ts
// Cliente do Apollo.io via gateway do Lovable.
//
// Usado APENAS como fallback de identificação quando a Lusha devolve zero
// decisores para um departamento. Chamamos `mixed_people/search`, que NÃO
// consome crédito de enriquecimento (não pedimos e-mail/telefone) — e-mail e
// telefone continuam vindo do fluxo LeadContact.
//
// Regras duras:
//  • Nunca chamar api.apollo.io direto — sempre o gateway.
//  • 403 API_INACCESSIBLE = chave sem acesso ao endpoint de people search
//    (exige master key). Vira `disabled: true`, o chamador degrada em silêncio.
//  • Timeout explícito: uma busca não pode ficar pendurada no Apollo.
// ============================================================================

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApolloError extends Error {
  status?: number;
  /** true quando repetir pode funcionar (429/5xx/timeout) */
  transient: boolean;
  /** true quando o fallback deve ser desligado nesta execução (401/403) */
  disabled: boolean;
}

export function makeApolloError(msg: string, status?: number): ApolloError {
  const err = new Error(msg) as ApolloError;
  err.status = status;
  err.transient = status === 429 || (status !== undefined && status >= 500) || status === undefined;
  err.disabled = status === 401 || status === 403;
  return err;
}

/** Mesmo formato do LushaSearchContact (structural typing, sem import cruzado). */
export interface ApolloSearchContact {
  fullName: string;
  jobTitle: string;
  seniority: string;
  linkedinUrl: string;
  department: string;
  departmentsAll: string[];
  hasRevealedEmail: boolean;
  hasPhone: boolean;
  raw: Record<string, unknown>;
}

export interface ApolloSearchResult {
  contacts: ApolloSearchContact[];
  total: number;
}

/** `true` quando as credenciais necessárias existem no ambiente. */
export function isApolloConfigured(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY")) && Boolean(Deno.env.get("APOLLO_API_KEY"));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normaliza um `person` do Apollo para o formato interno. */
export function normalizeApolloPerson(item: unknown): ApolloSearchContact | null {
  if (!item || typeof item !== "object") return null;
  const p = item as Record<string, unknown>;

  const fullName =
    str(p.name) ||
    [str(p.first_name), str(p.last_name)].filter(Boolean).join(" ").trim();
  const jobTitle = str(p.title);
  if (!fullName && !jobTitle) return null;

  const departments = Array.isArray(p.departments)
    ? (p.departments as unknown[]).map(str).filter(Boolean)
    : [];

  return {
    fullName,
    jobTitle,
    seniority: str(p.seniority),
    linkedinUrl: str(p.linkedin_url),
    department: departments[0] ?? "",
    departmentsAll: departments,
    // Fallback é só identificação: não pedimos nem usamos contato do Apollo.
    hasRevealedEmail: false,
    hasPhone: false,
    raw: p,
  };
}

/** Normaliza a resposta inteira, tolerando payload vazio ou malformado. */
export function normalizeApolloResponse(json: unknown): ApolloSearchResult {
  const j = (json ?? {}) as Record<string, unknown>;
  const people = Array.isArray(j.people)
    ? j.people
    : Array.isArray(j.contacts)
      ? j.contacts
      : [];
  const contacts = people
    .map(normalizeApolloPerson)
    .filter((c): c is ApolloSearchContact => c !== null);

  const pagination = (j.pagination ?? {}) as Record<string, unknown>;
  const total = typeof pagination.total_entries === "number"
    ? pagination.total_entries
    : contacts.length;

  return { contacts, total };
}

export interface SearchPeopleParams {
  /** domínio normalizado da empresa — obrigatório (chave de casamento) */
  domain: string;
  titles?: string[];
  departments?: string[];
  size?: number;
  timeoutMs?: number;
}

/**
 * Busca pessoas por domínio no Apollo. Só identificação — nenhum campo de
 * contato é solicitado, então não há consumo de crédito de enriquecimento.
 */
export async function searchPeopleByDomain(
  params: SearchPeopleParams,
): Promise<ApolloSearchResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey = Deno.env.get("APOLLO_API_KEY");
  if (!lovableKey || !connectionKey) {
    throw makeApolloError("apollo não configurado (LOVABLE_API_KEY/APOLLO_API_KEY ausentes)", 401);
  }
  const domain = params.domain.trim();
  if (!domain) throw makeApolloError("apollo: domínio ausente", 400);

  const size = Math.min(Math.max(params.size ?? 25, 1), 100);
  const body: Record<string, unknown> = {
    q_organization_domains_list: [domain],
    page: 1,
    per_page: size,
  };
  if (params.titles?.length) body.person_titles = params.titles;
  if (params.departments?.length) body.person_departments = params.departments;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/api/v1/mixed_people/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw makeApolloError(`apollo people/search falhou: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw makeApolloError(`apollo people/search [${res.status}]: ${text.slice(0, 400)}`, res.status);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw makeApolloError("apollo people/search: resposta não-JSON", 502);
  }

  // Apollo às vezes devolve 200 com erro no corpo.
  const j = json as Record<string, unknown>;
  if (j && typeof j.error_code === "string") {
    const status = j.error_code === "API_INACCESSIBLE" ? 403 : 502;
    throw makeApolloError(`apollo people/search: ${j.error_code} ${str(j.error_message)}`, status);
  }

  return normalizeApolloResponse(json);
}
