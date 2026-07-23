/**
 * Cálculo determinístico do `config_hash` para `instagram_scrape_queue`.
 *
 * Contrato de estabilidade:
 *  - Mesma tupla (organization_id, target_type, target_value normalizado, limit)
 *    ⇒ mesmo hash, independente da ordem em que os campos foram construídos.
 *  - Case-insensitive no target_value; ignora prefixos `@` / `#` e espaços.
 *  - `limit` é coagido a inteiro (default 200, clamp 1..1000) e faz parte do payload.
 *
 * Qualquer mudança neste contrato invalida deduplicação em fila — evitar.
 */

export type InstagramTargetType = "profile" | "posts" | "hashtag" | "comments";

export interface ConfigHashInput {
  organization_id: string;
  target_type: InstagramTargetType;
  target_value: string;
  limit?: number;
}

export function normalizeTarget(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^#/, "");
}

export function clampLimit(v: unknown, def = 200): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Serialização canônica — chaves ordenadas — para blindar contra reordenação. */
export function canonicalizeConfig(input: ConfigHashInput): string {
  const payload = {
    limit: clampLimit(input.limit),
    organization_id: String(input.organization_id ?? ""),
    target: normalizeTarget(input.target_value),
    target_type: input.target_type,
  };
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = (payload as Record<string, unknown>)[k];
      return acc;
    }, {});
  return JSON.stringify(ordered);
}

export async function computeConfigHash(input: ConfigHashInput): Promise<string> {
  return sha256Hex(canonicalizeConfig(input));
}
