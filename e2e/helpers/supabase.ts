import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers de backend para os testes E2E de garantias de RLS.
 *
 * Os testes de RLS não precisam do browser: eles falam diretamente com a Data
 * API usando a chave `anon` (pública/publishable — seguro em código) e, quando
 * disponíveis, credenciais de dois usuários de teste distintos para provar o
 * isolamento multi-tenant.
 *
 * Variáveis de ambiente reconhecidas (as duas primeiras são obrigatórias — sem
 * elas a suíte lança em vez de testar um backend que não é o do sistema):
 *   - E2E_SUPABASE_URL | VITE_SUPABASE_URL
 *   - E2E_SUPABASE_ANON_KEY | VITE_SUPABASE_PUBLISHABLE_KEY
 *   - E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD  (tenant A)
 *   - E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD  (tenant B)
 */

/** Lê a primeira variável de ambiente definida; lança se nenhuma existir. */
function requiredEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value;
  }
  throw new Error(`[e2e] defina ${names.join(" ou ")}`);
}

export const SUPABASE_URL = requiredEnv(["E2E_SUPABASE_URL", "VITE_SUPABASE_URL"]);

export const SUPABASE_ANON_KEY = requiredEnv([
  "E2E_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
]);

/** Cria um client anônimo (sem sessão) — usado para provar que RLS bloqueia leituras públicas. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUserCreds {
  email: string;
  password: string;
}

/** Lê as credenciais do tenant A/B do ambiente, se configuradas. */
export function getTenantCreds(): { a: TestUserCreds | null; b: TestUserCreds | null } {
  const a =
    process.env.E2E_USER_A_EMAIL && process.env.E2E_USER_A_PASSWORD
      ? { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD }
      : null;
  const b =
    process.env.E2E_USER_B_EMAIL && process.env.E2E_USER_B_PASSWORD
      ? { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD }
      : null;
  return { a, b };
}

/** Cria um client autenticado como o usuário indicado. Lança se o login falhar. */
export async function authedClient(creds: TestUserCreds): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(creds);
  if (error) throw new Error(`Login E2E falhou para ${creds.email}: ${error.message}`);
  return client;
}

/** Códigos que significam "a Data API recusou o acesso", não "backend fora do ar". */
const PERMISSION_DENIED_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

/**
 * Uma leitura é considerada "bloqueada por RLS" **apenas** quando a Data API
 * responde recusando o acesso (permissão/JWT) ou quando responde com zero
 * linhas — que é a política negando todas as linhas ao papel anônimo.
 *
 * Qualquer outro erro (rede, DNS, tabela inexistente, 5xx) lança: a suíte
 * precisa falhar quando não conseguiu falar com o banco, em vez de contar isso
 * como "bloqueado" e ficar verde sem nenhuma ida à rede.
 */
export function isReadBlocked(result: { data: unknown[] | null; error: unknown }): boolean {
  if (result.error) {
    const error = result.error as { code?: string; status?: number; message?: string };
    if (typeof error.status === "number" && (error.status === 401 || error.status === 403)) {
      return true;
    }
    if (typeof error.code === "string" && PERMISSION_DENIED_CODES.has(error.code)) return true;
    throw new Error(
      `[e2e] não foi possível falar com o backend (código ${error.code ?? "?"}): ${
        error.message ?? String(result.error)
      }`,
    );
  }
  return Array.isArray(result.data) && result.data.length === 0;
}
