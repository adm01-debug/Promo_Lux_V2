// _shared/web-scrape/heuristics.ts
// Heurísticas puras para classificar respostas HTTP como "SPA vazia" ou
// como conteúdo insuficiente. Isoladas para testabilidade.

/**
 * SPA sem SSR: shell HTML mínimo, texto visível curto e scripts pesados.
 * Retorna true se o corpo aparenta ser um shell vazio de app JS.
 */
export function isEmptyShell(html: string, extractedTextLen: number): boolean {
  const hasRoot = /<div\s+id=["'](root|app|__next|__nuxt)["']\s*>\s*<\/div>/i.test(html);
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  // Shell: root vazio E texto extraído muito curto E muitos scripts.
  if (hasRoot && extractedTextLen < 200 && scriptCount >= 2) return true;
  // Fallback: HTML grande, texto muito pequeno → provavelmente SPA.
  if (html.length > 5000 && extractedTextLen < 100 && scriptCount >= 3) return true;
  return false;
}

/** Classifica se erro/status é transitório (retentar) ou permanente (dead). */
export function isTransientHttp(status: number | null): boolean {
  if (status === null) return true; // rede/timeout
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/** Extrai hostname para chave de circuit breaker (`web:hostname`). */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
