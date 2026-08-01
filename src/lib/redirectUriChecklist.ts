/**
 * Compara um redirect URI digitado (candidato) contra entradas autorizadas no
 * provedor OAuth (Google Cloud Console / Azure App Registration), destacando
 * divergências exatas — incluindo trailing slash, porta, query string e hash —
 * já que provedores OAuth exigem match byte-a-byte.
 */

export type CheckSeverity = "ok" | "warning" | "error";

export interface ChecklistItem {
  id: string;
  label: string;
  severity: CheckSeverity;
  message: string;
  expected?: string;
  actual?: string;
}

export interface UriComparison {
  authorized: string;
  authorizedNormalized: string;
  exactMatch: boolean;
  items: ChecklistItem[];
  /** Todos os items com severity !== "ok". */
  divergences: ChecklistItem[];
}

export interface ChecklistReport {
  candidate: string;
  candidateNormalized: string;
  parseError: string | null;
  /** Avaliações estáticas (sintaxe / formato do candidato). */
  baseChecks: ChecklistItem[];
  /** Comparação contra cada URI autorizado fornecido pelo usuário. */
  comparisons: UriComparison[];
  /** Melhor candidato (exact match ou menor número de divergências). */
  bestMatch: UriComparison | null;
  hasExactMatch: boolean;
}

function safeParse(input: string): URL | null {
  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

/** Reconstrói o URI canônico preservando trailing slash do path original. */
export function normalizeRedirectUri(input: string): string {
  const u = safeParse(input);
  if (!u) return input.trim();
  // Mantém path como está (não remove trailing slash — provedores diferenciam).
  const path = u.pathname || "/";
  const search = u.search; // preserva query
  const hash = u.hash; // preserva fragment
  const port = u.port ? `:${u.port}` : "";
  return `${u.protocol}//${u.hostname}${port}${path}${search}${hash}`;
}

function pathHasTrailingSlash(path: string): boolean {
  return path.length > 1 && path.endsWith("/");
}

function staticChecks(candidate: string, parsed: URL | null): ChecklistItem[] {
  const out: ChecklistItem[] = [];

  if (!parsed) {
    out.push({
      id: "syntax",
      label: "Sintaxe da URL",
      severity: "error",
      message: "Não foi possível interpretar como URL. Use formato https://host/path.",
      actual: candidate,
    });
    return out;
  }

  out.push({
    id: "syntax",
    label: "Sintaxe da URL",
    severity: "ok",
    message: "URL válida e bem formada.",
    actual: parsed.toString(),
  });

  // Protocolo
  if (parsed.protocol === "https:") {
    out.push({ id: "protocol", label: "Protocolo HTTPS", severity: "ok", message: "Usando https — exigido em produção." });
  } else if (parsed.protocol === "http:") {
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    out.push({
      id: "protocol",
      label: "Protocolo HTTPS",
      severity: isLocal ? "warning" : "error",
      message: isLocal
        ? "http:// só é aceito em localhost — provedores rejeitam em produção."
        : "Provedores OAuth recusam http:// fora de localhost. Troque para https://.",
      actual: parsed.protocol,
      expected: "https:",
    });
  } else {
    out.push({
      id: "protocol",
      label: "Protocolo HTTPS",
      severity: "error",
      message: `Protocolo "${parsed.protocol}" não é suportado.`,
      actual: parsed.protocol,
      expected: "https:",
    });
  }

  // Trailing slash no path
  out.push({
    id: "trailing_slash",
    label: "Trailing slash",
    severity: "ok",
    message: pathHasTrailingSlash(parsed.pathname)
      ? 'Path termina com "/". O provedor exige o MESMO trailing slash na entrada autorizada.'
      : 'Path NÃO termina com "/". A entrada autorizada também não pode ter trailing slash.',
    actual: parsed.pathname,
  });

  // Query string
  if (parsed.search) {
    out.push({
      id: "query",
      label: "Query string",
      severity: "warning",
      message:
        "Redirect URI contém query string (?param=…). Google rejeita; Microsoft aceita mas exige match exato.",
      actual: parsed.search,
    });
  }

  // Fragment
  if (parsed.hash) {
    out.push({
      id: "fragment",
      label: "Fragmento (hash)",
      severity: "error",
      message: "Provedores OAuth ignoram fragmentos (#…) — remova antes de cadastrar.",
      actual: parsed.hash,
    });
  }

  // Porta explícita
  if (parsed.port) {
    out.push({
      id: "port",
      label: "Porta explícita",
      severity: "warning",
      message: `Porta ":${parsed.port}" presente — a entrada autorizada precisa ter EXATAMENTE a mesma porta.`,
      actual: parsed.port,
    });
  }

  return out;
}

function compareAgainst(candidate: URL, candidateRaw: string, authorizedRaw: string): UriComparison {
  const authorized = authorizedRaw.trim();
  const authorizedNorm = normalizeRedirectUri(authorized);
  const candidateNorm = normalizeRedirectUri(candidateRaw);
  const parsed = safeParse(authorized);
  const items: ChecklistItem[] = [];

  if (!parsed) {
    items.push({
      id: "auth_syntax",
      label: "Entrada autorizada válida",
      severity: "error",
      message: "Esta entrada autorizada não é uma URL válida — corrija no provedor.",
      actual: authorized,
    });
    return {
      authorized,
      authorizedNormalized: authorized,
      exactMatch: false,
      items,
      divergences: items,
    };
  }

  const exact = candidateNorm === authorizedNorm;
  items.push({
    id: "exact",
    label: "Match exato (byte-a-byte)",
    severity: exact ? "ok" : "error",
    message: exact
      ? "Match perfeito — provedor aceitará este redirect."
      : "Diferença detectada. Provedores exigem match exato; veja os campos abaixo.",
    expected: authorizedNorm,
    actual: candidateNorm,
  });

  const cmp = (id: string, label: string, expected: string, actual: string, hint: string): ChecklistItem => ({
    id,
    label,
    severity: expected === actual ? "ok" : "error",
    message: expected === actual ? `${label} idêntico.` : hint,
    expected,
    actual,
  });

  items.push(
    cmp(
      "protocol_match",
      "Protocolo",
      parsed.protocol,
      candidate.protocol,
      `Protocolos diferem: autorizado é "${parsed.protocol}", você enviou "${candidate.protocol}".`,
    ),
  );
  items.push(
    cmp(
      "host_match",
      "Host",
      parsed.hostname.toLowerCase(),
      candidate.hostname.toLowerCase(),
      `Hosts diferem: autorizado é "${parsed.hostname}", você enviou "${candidate.hostname}".`,
    ),
  );
  items.push(
    cmp(
      "port_match",
      "Porta",
      parsed.port || "(default)",
      candidate.port || "(default)",
      `Portas diferem: autorizada "${parsed.port || "(default)"}" vs enviada "${candidate.port || "(default)"}".`,
    ),
  );

  // Trailing slash diff (mesmo path "logico" mas com/sem slash)
  const pathExp = parsed.pathname || "/";
  const pathAct = candidate.pathname || "/";
  if (pathExp !== pathAct) {
    const stripExp = pathExp.replace(/\/+$/, "") || "/";
    const stripAct = pathAct.replace(/\/+$/, "") || "/";
    if (stripExp === stripAct) {
      items.push({
        id: "trailing_slash_match",
        label: "Trailing slash",
        severity: "error",
        message:
          'Diferença SOMENTE no trailing slash final. Provedores tratam "/path" e "/path/" como entradas distintas — alinhe os dois.',
        expected: pathExp,
        actual: pathAct,
      });
    } else {
      items.push({
        id: "path_match",
        label: "Path",
        severity: "error",
        message: `Paths diferem: autorizado "${pathExp}" vs enviado "${pathAct}".`,
        expected: pathExp,
        actual: pathAct,
      });
    }
  } else {
    items.push({
      id: "path_match",
      label: "Path",
      severity: "ok",
      message: "Paths idênticos (incluindo trailing slash).",
      expected: pathExp,
      actual: pathAct,
    });
  }

  // Query
  items.push(
    cmp(
      "query_match",
      "Query string",
      parsed.search || "(nenhuma)",
      candidate.search || "(nenhuma)",
      `Query string diverge: autorizada "${parsed.search || "(nenhuma)"}" vs enviada "${candidate.search || "(nenhuma)"}".`,
    ),
  );

  // Hash
  if (parsed.hash || candidate.hash) {
    items.push({
      id: "hash_match",
      label: "Fragmento (hash)",
      severity: "warning",
      message:
        "Fragmentos são ignorados pelos provedores; remova de ambos os lados para evitar confusão.",
      expected: parsed.hash || "(nenhum)",
      actual: candidate.hash || "(nenhum)",
    });
  }

  return {
    authorized,
    authorizedNormalized: authorizedNorm,
    exactMatch: exact,
    items,
    divergences: items.filter((i) => i.severity !== "ok"),
  };
}

/**
 * Roda o checklist completo: parsing do candidato, validações estáticas e
 * comparação contra a lista de URIs autorizados (uma por linha ou separados
 * por vírgula).
 */
export function buildRedirectUriChecklist(candidate: string, authorizedList: string[]): ChecklistReport {
  const trimmed = candidate.trim();
  const parsed = safeParse(trimmed);
  const baseChecks = staticChecks(trimmed, parsed);
  const cleanAuthorized = authorizedList.map((a) => a.trim()).filter(Boolean);

  const comparisons: UriComparison[] = parsed
    ? cleanAuthorized.map((a) => compareAgainst(parsed, trimmed, a))
    : [];

  const exact = comparisons.find((c) => c.exactMatch) ?? null;
  const best =
    exact ??
    [...comparisons].sort((a, b) => a.divergences.length - b.divergences.length)[0] ??
    null;

  return {
    candidate: trimmed,
    candidateNormalized: parsed ? normalizeRedirectUri(trimmed) : trimmed,
    parseError: parsed ? null : "URL inválida — não foi possível analisar.",
    baseChecks,
    comparisons,
    bestMatch: best,
    hasExactMatch: !!exact,
  };
}

/** Parse linhas / vírgulas em URIs distintos. */
export function parseAuthorizedInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}