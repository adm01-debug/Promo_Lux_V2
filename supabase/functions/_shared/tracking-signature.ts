// Assinatura HMAC para links de tracking (track-click/track-open).
//
// track-click fazia 302 para qualquer `u` http(s) sem vínculo criptográfico
// com o destinatário — um atacante podia montar
// `.../track-click?u=https://phishing.example&r=<uuid qualquer>` e obter um
// redirect confiável a partir do domínio do Supabase do projeto (open
// redirect). Este módulo define o contrato que qualquer gerador de link de
// tracking (ex.: campaign-dispatch, quando enviar emails reais) deve seguir:
// assinar `recipientId` + `url` com um segredo do servidor, e as edge
// functions públicas verificam a assinatura antes de agir.
const ENCODER = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function payloadFor(recipientId: string, url: string | null): string {
  return `${recipientId}:${url ?? ""}`;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload));
  return toHex(sig);
}

/** Gera a assinatura para um link de tracking. `url` é `null` para o pixel de open. */
export async function signTrackingParams(recipientId: string, url: string | null, secret: string): Promise<string> {
  return hmacHex(secret, payloadFor(recipientId, url));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica a assinatura de um link de tracking recebido. */
export async function verifyTrackingParams(
  recipientId: string,
  url: string | null,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacHex(secret, payloadFor(recipientId, url));
  return timingSafeEqualHex(expected, signature);
}
