// ============================================================================
// _shared/company-domain.ts
// Normalização e resolução do domínio da empresa — chave de casamento entre
// Lusha e Apollo. Módulo puro, sem dependências, testável fora do Deno.
//
// Sem domínio confiável o fallback do Apollo NÃO roda: buscar só por nome
// traria decisores de empresas homônimas (risco real no Brasil: "Ambev",
// "Atlas", "Delta" existem dezenas de vezes no cadastro do Apollo).
// ============================================================================

/** Domínios genéricos de e-mail — nunca representam a empresa. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
  "live.com", "icloud.com", "bol.com.br", "uol.com.br", "terra.com.br",
  "msn.com", "aol.com", "protonmail.com", "me.com", "globo.com",
]);

/**
 * Normaliza qualquer coisa que "pareça" um domínio para a forma canônica:
 * minúsculas, sem scheme, sem `www.`, sem usuário de e-mail, sem porta,
 * sem caminho/query/fragment e sem ponto final.
 *
 * Retorna "" quando o valor não é um domínio plausível (nulo, vazio,
 * sem ponto, com espaços internos, ou provedor de e-mail gratuito).
 */
export function normalizeDomain(input: string | null | undefined): string {
  let v = String(input ?? "").trim().toLowerCase();
  if (!v) return "";

  // e-mail -> parte após o @
  const at = v.lastIndexOf("@");
  if (at >= 0) v = v.slice(at + 1);

  // scheme
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");

  // credenciais residuais (user:pass@host)
  const at2 = v.lastIndexOf("@");
  if (at2 >= 0) v = v.slice(at2 + 1);

  // caminho / query / fragment
  v = v.split("/")[0].split("?")[0].split("#")[0];

  // porta
  v = v.split(":")[0];

  // www. (só o primeiro nível)
  v = v.replace(/^www\./, "");

  // ponto final de FQDN absoluto
  v = v.replace(/\.$/, "");

  if (!v || v.includes(" ")) return "";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(v)) return "";
  if (FREE_EMAIL_DOMAINS.has(v)) return "";
  return v;
}

export interface DomainCandidates {
  /** companies.website — maior confiança (cadastro do próprio usuário) */
  companyWebsite?: string | null;
  /** company_email_domain devolvido pela Lusha */
  lushaEmailDomain?: string | null;
  /** fqdn/website do match de empresa da Lusha */
  lushaCompanyDomain?: string | null;
}

export interface ResolvedDomain {
  domain: string;
  source: "company_website" | "lusha_email_domain" | "lusha_company" | "none";
}

/**
 * Resolve o domínio por ordem de confiança. A primeira fonte que normalizar
 * para um domínio válido vence.
 */
export function resolveCompanyDomain(c: DomainCandidates): ResolvedDomain {
  const ordered: Array<[ResolvedDomain["source"], string | null | undefined]> = [
    ["company_website", c.companyWebsite],
    ["lusha_email_domain", c.lushaEmailDomain],
    ["lusha_company", c.lushaCompanyDomain],
  ];
  for (const [source, raw] of ordered) {
    const domain = normalizeDomain(raw);
    if (domain) return { domain, source };
  }
  return { domain: "", source: "none" };
}
