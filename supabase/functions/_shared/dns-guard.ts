// ============================================================================
// _shared/dns-guard.ts
// Regras PURAS (sem rede) para funções que só consultam DNS de um domínio
// informado pelo usuário (deliverability-check, email-verify). Essas funções
// nunca abrem conexão com o alvo, então o risco é virar oráculo de DNS de
// nomes internos. Aqui barramos nomes internos e IPs literais em qualquer
// formato (decimal, hex, octal, pontos) exigindo um TLD alfabético.
// Para fetch() de URL use _shared/ssrf-guard.ts (resolve e valida o IP).
// ============================================================================
import { isDisallowedHostLiteral } from "./ssrf-guard.ts";

const SUFIXOS_INTERNOS = [
  ".local",
  ".localhost",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".lan",
  ".intranet",
  ".corp",
];

/** true quando o domínio NÃO pode ser consultado (interno, reservado ou IP literal). */
export function isBlockedLookupDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!d || d.length > 253) return true;
  if (isDisallowedHostLiteral(d)) return true;
  if (SUFIXOS_INTERNOS.some((s) => d === s.slice(1) || d.endsWith(s)))
    return true;
  const rotulos = d.split(".");
  if (
    rotulos.length < 2 ||
    rotulos.some(
      (r) =>
        !/^[a-z0-9-]{1,63}$/.test(r) || r.startsWith("-") || r.endsWith("-"),
    )
  )
    return true;
  // TLD alfabético (ou IDN xn--): bloqueia 127.0.0.1, 2130706433, 0x7f.1, 017700000001...
  const tld = rotulos[rotulos.length - 1];
  return !(/^[a-z]{2,63}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld));
}

/** RFC 7505: um MX com exchange "." (ou vazio) declara que o domínio NÃO recebe e-mail. */
export function isNullMx(exchange: string): boolean {
  const e = exchange.trim();
  return e === "" || e === ".";
}

/** MX utilizáveis (sem o MX nulo), ordenados por preferência. */
export function usableMx(
  records: { preference: number; exchange: string }[],
): string[] {
  return records
    .filter((r) => !isNullMx(r.exchange))
    .sort((a, b) => a.preference - b.preference)
    .map((r) => r.exchange);
}

/** RFC 6376 §3.6.1: `p=` vazio significa chave DKIM revogada. */
export function isRevokedDkim(record: string): boolean {
  const m = record.match(/(?:^|;)\s*p\s*=\s*([^;]*)/i);
  return m !== null && m[1].replace(/\s+/g, "") === "";
}
