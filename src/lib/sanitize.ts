/**
 * Input sanitization utilities to prevent XSS.
 * Use these before rendering user-generated content or sending to APIs.
 */

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const ENTITY_RE = /[&<>"'/]/g;

/** Escape HTML entities in a string */
export function escapeHtml(str: string): string {
  return str.replace(ENTITY_RE, (char) => ENTITY_MAP[char] || char);
}

/** Strip all HTML tags from a string */
export function stripTags(str: string): string {
  // O primeiro replace só casa tags fechadas (<...>). Uma tag sem `>` no
  // fim da string (ex.: entrada truncada em maxLength, ou um payload como
  // "<script src=//evil") sobrevivia intacta — se essa string depois for
  // concatenada com outro HTML que contenha um `>` posterior, o navegador
  // pode interpretar tudo entre os dois como uma tag válida.
  return str.replace(/<[^>]*>/g, "").replace(/<[^>]*$/g, "");
}

/** Sanitize user input: trim, strip tags, limit length */
export function sanitizeInput(input: string, maxLength = 1000): string {
  return stripTags(input).trim().slice(0, maxLength);
}

/** Sanitize a URL — only allow http(s) and mailto protocols */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9][\w.-]*\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return "";
}

/** Validate and sanitize email */
export function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRe.test(trimmed) ? trimmed : "";
}
