// ============================================================================
// _shared/linkedin-url.ts
// Extração de publicId a partir de URL de perfil LinkedIn.
// Módulo puro e sem dependências — testável fora do Deno.
// ============================================================================

/**
 * Extrai o publicId de um perfil LinkedIn.
 * Aceita: qualquer subdomínio de país (br./de./www./nenhum), com ou sem scheme,
 * com query string, fragment, trailing slash, percent-encoding, ou o publicId cru.
 * Retorna "" para o que não for um perfil /in/ (ex.: /pub/, /company/).
 */
export function publicIdFromLinkedInUrl(url: string | null | undefined): string {
  if (!url) return "";
  const s = url.trim().split("?")[0].split("#")[0];
  const m = s.match(/(?:^|\/\/)(?:[a-z0-9-]+\.)*linkedin\.com\/in\/([^/?#]+)/i);
  if (m) return safeDecode(m[1]);
  const m2 = s.match(/^\/?in\/([^/?#]+)/i);
  if (m2) return safeDecode(m2[1]);
  if (!s.includes("/") && !s.includes(".") && !s.includes(":")) return safeDecode(s);
  return "";
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v).trim();
  } catch {
    return v.trim();
  }
}
