// Geração de links de tracking (pixel de open + links de click) para emails.
//
// O dispatch de campanhas (campaign-dispatch) envia os emails; para cada
// destinatário ele precisa:
//   1. Assinar o par (recipientId, url) com TRACKING_SIGNING_SECRET usando o
//      contrato de _shared/tracking-signature.ts;
//   2. Montar a URL pública das edge functions track-open/track-click;
//   3. Insertar o pixel 1x1 no HTML e reescrever links http(s) do corpo.
//
// Este módulo centraliza esses três passos, mantendo o dispatch enxuto e o
// comportamento testável de forma isolada (padrão dos helpers em _shared/).
//
// As funções são 100% puras (recebem a base pública e o secret como
// parâmetros) para permitir testes unitários sem rede nem env.
import { signTrackingParams, verifyTrackingParams } from "./tracking-signature.ts";

/** Monta a URL pública do pixel de open para um destinatário. */
export async function openTrackingUrl(basePublicUrl: string, recipientId: string, secret: string): Promise<string> {
  const sig = await signTrackingParams(recipientId, null, secret);
  return `${basePublicUrl}/functions/v1/track-open?r=${encodeURIComponent(recipientId)}&s=${encodeURIComponent(sig)}`;
}

/** Monta a URL pública de redirect rastreado (track-click) para uma URL destino. */
export async function clickTrackingUrl(
  basePublicUrl: string,
  recipientId: string,
  targetUrl: string,
  secret: string,
): Promise<string> {
  const sig = await signTrackingParams(recipientId, targetUrl, secret);
  return `${basePublicUrl}/functions/v1/track-click?r=${encodeURIComponent(recipientId)}&u=${encodeURIComponent(targetUrl)}&s=${encodeURIComponent(sig)}`;
}

// Limite defensivo do número de links reescritos por email (evita abuso/overhead).
const MAX_TRACKED_LINKS = 50;

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.),:;!?]/g;

/**
 * Insere o pixel de open (1x1 transparente) e reescreve os links http(s) do
 * corpo do email para passarem pelo track-click assinado. Retorna o HTML.
 *
 * Links já pertencentes ao domínio público das edge functions (como URLs
 * internas do produto ou de track anteriores) são preservados sem wrap, para
 * evitar redirect recursivo.
 */
export async function applyEmailTracking(
  basePublicUrl: string,
  recipientId: string,
  bodyPlain: string,
  secret: string,
): Promise<{ html: string; trackedCount: number }> {
  const segments = bodyPlain.split(URL_RE);
  const links = bodyPlain.match(URL_RE) ?? [];
  const tracked: string[] = [];

  for (let i = 0; i < links.length && i < MAX_TRACKED_LINKS; i++) {
    const url = links[i];
    if (url.startsWith(basePublicUrl)) {
      tracked.push(url); // preserva sem wrap
      continue;
    }
    tracked.push(await clickTrackingUrl(basePublicUrl, recipientId, url, secret));
  }
  // Se estourar o limite, mantém os links restantes originais (nunca quebra o email).
  for (let i = MAX_TRACKED_LINKS; i < links.length; i++) tracked.push(links[i]);

  // Reconstrói o HTML unindo segmentos e links, com quebras de linha em <br/>.
  let html = "";
  for (let i = 0; i < segments.length; i++) {
    html += escapeHtml(segments[i]).replace(/\r?\n/g, "<br/>");
    if (i < tracked.length) html += `<a href="${escapeHtml(tracked[i])}">${escapeHtml(links[i])}</a>`;
  }

  const pixel = await openTrackingUrl(basePublicUrl, recipientId, secret);
  const pixelTag = `<img src="${escapeHtml(pixel)}" width="1" height="1" alt="" style="display:none" />`;

  return {
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${html}</div>${pixelTag}`,
    trackedCount: Math.min(links.length, MAX_TRACKED_LINKS),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { verifyTrackingParams };