// ============================================================================
// _shared/cookies.ts
// Fetch de cookies do vault self-hosted (paridade com n8n).
// Retry 3x com backoff exponencial 1s → 3s → 9s. Sem cache local.
// ============================================================================

export type ServicoCookie = "lusha" | "leadcontact" | "linkedin";

export interface VaultCookie {
  servico: ServicoCookie;
  cookie: string;
  is_healthy: boolean;
  expires_at: string | null;
  atualizado_em: string | null;
}

export class CookieVaultUnavailable extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CookieVaultUnavailable";
  }
}

export class CookieNotReady extends Error {
  constructor(public readonly servico: ServicoCookie, message: string) {
    super(message);
    this.name = "CookieNotReady";
  }
}

const DELAYS_MS = [1000, 3000, 9000];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Busca todos os cookies do vault. Faz 3 tentativas com backoff.
 * Lança CookieVaultUnavailable se todas falharem.
 */
export async function fetchAllCookies(): Promise<Map<ServicoCookie, VaultCookie>> {
  const externalUrl = Deno.env.get("SUPABASE_EXTERNAL_URL") ?? "https://supabase.atomicabr.com.br";
  const externalKey = Deno.env.get("EXTERNAL_VAULT_ANON_KEY") ?? Deno.env.get("SUPABASE_EXTERNAL_ANON_KEY");
  if (!externalKey) {
    throw new CookieVaultUnavailable("SUPABASE_EXTERNAL_ANON_KEY ausente");
  }

  const url =
    `${externalUrl}/rest/v1/cookies_config` +
    `?servico=in.(lusha,leadcontact,linkedin)` +
    `&select=servico,cookie,is_healthy,expires_at,atualizado_em`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { apikey: externalKey, Authorization: `Bearer ${externalKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`vault HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const rows = (await res.json()) as VaultCookie[];
      const map = new Map<ServicoCookie, VaultCookie>();
      for (const r of rows) {
        if (r.servico === "lusha" || r.servico === "leadcontact" || r.servico === "linkedin") {
          map.set(r.servico, r);
        }
      }
      return map;
    } catch (err) {
      lastErr = err;
      if (attempt < DELAYS_MS.length - 1) await sleep(DELAYS_MS[attempt]);
    }
  }
  throw new CookieVaultUnavailable(
    `Vault indisponível após 3 tentativas: ${(lastErr as Error)?.message ?? "erro desconhecido"}`,
    lastErr,
  );
}

/**
 * Retorna um cookie específico, validando saúde e expiração.
 * Lança CookieNotReady se ausente/expirado/unhealthy.
 */
export async function getCookie(servico: ServicoCookie): Promise<VaultCookie> {
  const all = await fetchAllCookies();
  const c = all.get(servico);
  if (!c) throw new CookieNotReady(servico, `cookie '${servico}' ausente no vault`);
  if (!c.cookie || c.cookie.length < 10) {
    throw new CookieNotReady(servico, `cookie '${servico}' vazio no vault`);
  }
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
    throw new CookieNotReady(servico, `cookie '${servico}' expirado`);
  }
  if (c.is_healthy === false) {
    throw new CookieNotReady(servico, `cookie '${servico}' marcado como unhealthy`);
  }
  return c;
}

/**
 * Extrai o valor do JSESSIONID de um cookie header LinkedIn completo,
 * removendo aspas circundantes (paridade com regex do n8n).
 */
export function extractLinkedInCsrfToken(linkedinCookie: string): string | null {
  const match = linkedinCookie.match(/JSESSIONID=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  return (match[1] ?? match[2] ?? "").trim();
}

/**
 * Extrai o valor `SESSION=xxx` de um cookie LeadContact.
 * Aceita tanto o header completo quanto apenas o valor bruto.
 */
export function extractLeadContactSession(leadContactCookie: string): string {
  const match = leadContactCookie.match(/SESSION=([^;]+)/i);
  return (match?.[1] ?? leadContactCookie).trim();
}
