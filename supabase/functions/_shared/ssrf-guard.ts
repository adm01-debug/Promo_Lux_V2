// ============================================================================
// _shared/ssrf-guard.ts
// Toda função que faz fetch() para uma URL fornecida pelo usuário (webhooks
// de outbound, integrações, etc.) precisa validar o destino antes — senão um
// usuário pode apontar o webhook para http://169.254.169.254/latest/meta-data
// (metadata da cloud) ou para um host interno (localhost, 10.x, 192.168.x) e
// usar a função como proxy para escanear/ler a rede interna do provedor.
//
// Mitigação: exige https público e resolve o DNS do host, rejeitando
// qualquer IP resolvido em faixa privada/loopback/link-local/reservada.
// Residual: não protege contra DNS rebinding entre a checagem e o fetch()
// real (o runtime não expõe pinning de IP para fetch nativo) — mitiga o
// vetor de abuso direto (URL literal apontando para rede interna), que é o
// caso de uso real observado.
//
// A classificação de IP/host é pura e síncrona (testável fora do Deno); só
// `assertSafeOutboundUrl` depende de Deno.resolveDns, então é a única parte
// sem cobertura de teste unitário (mesma convenção de cookies.ts/
// bitrix-client.ts, que também isolam a chamada Deno.env.get das partes
// puras testadas).
// ============================================================================

export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true; // malformado -> bloqueia
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 2) return true; // 192.0.2.0/24 TEST-NET
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast (224+), reservado (240+) e broadcast (255.255.255.255)
  return false;
}

export function isPrivateOrReservedIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true; // loopback
  if (norm === "::") return true; // unspecified
  if (norm.startsWith("fe80:") || norm.startsWith("fe80::")) return true; // link-local
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // fc00::/7 ULA
  if (norm.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — valida a parte v4 embutida
    const v4 = norm.split(":").pop() ?? "";
    if (v4.includes(".")) return isPrivateOrReservedIPv4(v4);
  }
  return false;
}

export function isDisallowedHostLiteral(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "localhost.localdomain") return true;
  if (h === "metadata.google.internal") return true; // metadata GCP por nome
  return false;
}

export type UrlSafetyVerdict = { safe: boolean; reason?: string };

/**
 * Parte pura/síncrona da validação: protocolo, host literalmente proibido, e
 * IP literal (quando o host já é um IPv4/IPv6, não precisa de DNS). Retorna
 * `null` quando a decisão depende de resolver DNS (host é um nome) — nesse
 * caso o chamador (assertSafeOutboundUrl) completa a checagem.
 */
export function checkUrlSyncPart(rawUrl: string): UrlSafetyVerdict | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "url_invalida" };
  }

  if (url.protocol !== "https:") {
    return { safe: false, reason: "protocolo_deve_ser_https" };
  }

  const hostname = url.hostname;
  if (isDisallowedHostLiteral(hostname)) {
    return { safe: false, reason: "host_nao_permitido" };
  }

  const isLiteralIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isLiteralIPv6 = hostname.includes(":");
  if (isLiteralIPv4) {
    return isPrivateOrReservedIPv4(hostname)
      ? { safe: false, reason: "ip_privado_ou_reservado" }
      : { safe: true };
  }
  if (isLiteralIPv6) {
    // URL.hostname devolve hosts IPv6 ENTRE COLCHETES (ex.: "[::1]") — sem
    // remover, a comparação contra as constantes ("::1", "fe80:" etc) nunca
    // bate e o loopback/link-local IPv6 passaria disfarçado como "hostname
    // desconhecido" até a resolução de DNS (que nem roda para IP literal).
    const bareIp = hostname.replace(/^\[|\]$/g, "");
    return isPrivateOrReservedIPv6(bareIp)
      ? { safe: false, reason: "ip_privado_ou_reservado" }
      : { safe: true };
  }

  return null; // host é um nome — precisa resolver DNS
}

/**
 * Valida que `rawUrl` é segura para outbound fetch: https, host não-literal
 * privado/loopback, e todos os IPs resolvidos por DNS são públicos.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<UrlSafetyVerdict> {
  const syncVerdict = checkUrlSyncPart(rawUrl);
  if (syncVerdict) return syncVerdict;

  const hostname = new URL(rawUrl).hostname;
  try {
    const [aRecords, aaaaRecords] = await Promise.all([
      Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
      Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
    ]);
    if (aRecords.length === 0 && aaaaRecords.length === 0) {
      return { safe: false, reason: "dns_nao_resolveu" };
    }
    if (aRecords.some(isPrivateOrReservedIPv4) || aaaaRecords.some(isPrivateOrReservedIPv6)) {
      return { safe: false, reason: "resolve_para_ip_privado" };
    }
  } catch {
    return { safe: false, reason: "falha_ao_resolver_dns" };
  }

  return { safe: true };
}
