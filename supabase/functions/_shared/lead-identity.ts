// ============================================================================
// lead-identity.ts
// Identidade canônica de um lead (pessoa) para deduplicação ANTES de persistir.
//
// Por que existe: o mesmo decisor chega por dois caminhos (Lusha e Apollo) com
// grafias diferentes — "JOÃO DA SILVA JR." vs "Joao da Silva Jr", com/sem
// LinkedIn. O dedup antigo comparava string crua, então o mesmo humano entrava
// duas vezes no banco quando a fonte mudava a capitalização, o acento ou o
// sufixo. Aqui geramos CHAVES normalizadas e casamos por qualquer uma delas.
//
// Ordem de confiança das chaves (a primeira que casar já decide):
//   1. pid:<linkedin_public_id>       -> identidade forte, é o índice único do banco
//   2. dn:<domínio>|<nome normalizado> -> mesma empresa + mesma pessoa
//   3. nt:<nome normalizado>|<cargo normalizado> -> último recurso, sem domínio
//
// Sem nome normalizado NÃO há identidade: o registro é considerado inválido.
// ============================================================================
import { publicIdFromLinkedInUrl } from "./linkedin-url.ts";
import { normalizeDomain } from "./company-domain.ts";

/** Títulos de tratamento e sufixos que não distinguem pessoas. */
const HONORIFICS = new Set([
  "sr", "sra", "srta", "dr", "dra", "prof", "profa", "eng", "enga",
  "mr", "mrs", "ms", "miss", "phd", "mba", "msc", "bsc",
]);
const SUFFIXES = new Set(["jr", "junior", "filho", "neto", "sobrinho", "ii", "iii", "iv", "sr"]);

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nome de pessoa em forma canônica: sem acento, sem pontuação, sem títulos de
 * tratamento, sem sufixo geracional, minúsculo e com espaço simples.
 * "  Dr. JOÃO da Silva Jr. " -> "joao da silva"
 */
export function normalizePersonName(raw: string | null | undefined): string {
  if (!raw) return "";
  const base = stripDiacritics(String(raw))
    .toLowerCase()
    // remove qualquer coisa entre parênteses ("(ele/dele)", "(CPO)")
    .replace(/\([^)]*\)/g, " ")
    // e-mail ou handle colado no nome
    .replace(/\S+@\S+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";

  const tokens = base.split(" ").filter((t) => {
    if (!t) return false;
    if (HONORIFICS.has(t)) return false;
    return true;
  });
  // Sufixo geracional só é descartado quando NÃO é o único token restante
  // (evita zerar um nome que por acaso seja "Junior").
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** Cargo em forma canônica — usado só como desempate quando não há domínio. */
export function normalizeJobTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripDiacritics(String(raw))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LeadIdentityInput {
  fullName?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  /** public id já extraído (rows do banco têm a coluna GENERATED) */
  linkedinPublicId?: string | null;
  /** domínio da empresa do lead (canônico) */
  companyDomain?: string | null;
  /** e-mail do lead, quando a fonte já devolve — o domínio dele também casa */
  email?: string | null;
}

export interface LeadIdentity {
  name: string;
  title: string;
  publicId: string;
  domains: string[];
  /** vazio = registro sem identidade utilizável (deve ser descartado) */
  keys: string[];
}

export function leadIdentity(input: LeadIdentityInput): LeadIdentity {
  const name = normalizePersonName(input.fullName);
  const title = normalizeJobTitle(input.jobTitle);
  const publicId = (input.linkedinPublicId ?? "").trim() ||
    publicIdFromLinkedInUrl(input.linkedinUrl ?? null);

  const domains: string[] = [];
  const pushDomain = (d: string) => {
    if (d && !domains.includes(d)) domains.push(d);
  };
  pushDomain(normalizeDomain(input.companyDomain ?? ""));
  const email = (input.email ?? "").trim();
  if (email.includes("@")) pushDomain(normalizeDomain(email.split("@").pop() ?? ""));

  const keys: string[] = [];
  if (publicId) keys.push(`pid:${publicId}`);
  if (name) {
    for (const d of domains) keys.push(`dn:${d}|${name}`);
    if (title) keys.push(`nt:${name}|${title}`);
    // Sem domínio E sem cargo o nome sozinho ainda é melhor que nada, mas só
    // vale quando também não há publicId — senão dois homônimos distintos da
    // mesma empresa colidiriam.
    if (domains.length === 0 && !title && !publicId) keys.push(`n:${name}`);
  }
  return { name, title, publicId, domains, keys };
}

/** Precedência de fonte: quem tem mais qualidade de dado vence o merge. */
const SOURCE_RANK: Record<string, number> = { lusha: 2, apollo: 1 };

export interface DedupeResult<T> {
  kept: T[];
  /** quantos itens foram absorvidos por um já existente no lote */
  duplicates: number;
  /** chaves de tudo que sobrou — serve para consultar o banco depois */
  keysByIndex: string[][];
}

/**
 * Deduplica um lote de leads de fontes distintas.
 * Quando dois itens compartilham QUALQUER chave, mantém um só:
 *   - fonte de maior precedência vence;
 *   - empate: vence quem tem LinkedIn; depois quem tem cargo preenchido.
 * `merge` recebe (vencedor, perdedor) e devolve o registro final, permitindo
 * herdar campos que só o perdedor tinha (ex.: Apollo sem LinkedIn herdando o
 * linkedinUrl que a Lusha trouxe).
 */
export function dedupeLeads<T>(
  items: T[],
  identify: (item: T) => LeadIdentity,
  options: {
    sourceOf?: (item: T) => string;
    merge?: (winner: T, loser: T) => T;
  } = {},
): DedupeResult<T> {
  const sourceOf = options.sourceOf ?? (() => "lusha");
  const merge = options.merge ?? ((winner: T) => winner);

  const kept: T[] = [];
  const keptIdent: LeadIdentity[] = [];
  const keyToIndex = new Map<string, number>();
  let duplicates = 0;

  for (const item of items) {
    const ident = identify(item);
    if (ident.keys.length === 0) continue; // sem identidade -> descarta

    let matchIndex = -1;
    for (const key of ident.keys) {
      const found = keyToIndex.get(key);
      if (found !== undefined) { matchIndex = found; break; }
    }

    if (matchIndex === -1) {
      const index = kept.length;
      kept.push(item);
      keptIdent.push(ident);
      for (const key of ident.keys) if (!keyToIndex.has(key)) keyToIndex.set(key, index);
      continue;
    }

    duplicates += 1;
    const current = kept[matchIndex];
    const currentIdent = keptIdent[matchIndex];
    const challengerWins = scoreLead(sourceOf(item), ident) > scoreLead(sourceOf(current), currentIdent);
    const winner = challengerWins ? item : current;
    const loser = challengerWins ? current : item;
    kept[matchIndex] = merge(winner, loser);

    // A identidade do slot passa a ser a união das chaves dos dois.
    const mergedIdent = challengerWins ? ident : currentIdent;
    const unionKeys = Array.from(new Set([...currentIdent.keys, ...ident.keys]));
    keptIdent[matchIndex] = { ...mergedIdent, keys: unionKeys };
    for (const key of unionKeys) if (!keyToIndex.has(key)) keyToIndex.set(key, matchIndex);
  }

  return { kept, duplicates, keysByIndex: keptIdent.map((i) => i.keys) };
}

function scoreLead(source: string, ident: LeadIdentity): number {
  return (SOURCE_RANK[source] ?? 0) * 100 + (ident.publicId ? 10 : 0) + (ident.title ? 1 : 0);
}

/**
 * Índice de chaves do que JÁ está no banco, para não reinserir.
 * Aceita as linhas cruas de lusha_contacts.
 */
export function buildExistingKeyIndex(
  rows: Array<{
    full_name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    linkedin_public_id?: string | null;
    email?: string | null;
  }>,
  companyDomain?: string | null,
): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const ident = leadIdentity({
      fullName: row.full_name,
      jobTitle: row.job_title,
      linkedinUrl: row.linkedin_url,
      linkedinPublicId: row.linkedin_public_id,
      companyDomain,
      email: row.email,
    });
    for (const key of ident.keys) set.add(key);
  }
  return set;
}
