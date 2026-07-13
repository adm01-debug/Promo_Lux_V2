import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers de backend para os testes E2E de garantias de RLS.
 *
 * Os testes de RLS não precisam do browser: eles falam diretamente com a Data
 * API usando a chave `anon` (pública/publishable — seguro em código) e, quando
 * disponíveis, credenciais de dois usuários de teste distintos para provar o
 * isolamento multi-tenant.
 *
 * Variáveis de ambiente reconhecidas (todas opcionais, com fallback público):
 *   - E2E_SUPABASE_URL | VITE_SUPABASE_URL
 *   - E2E_SUPABASE_ANON_KEY | VITE_SUPABASE_PUBLISHABLE_KEY
 *   - E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD  (tenant A)
 *   - E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD  (tenant B)
 */

const FALLBACK_URL = "https://pesfxhlbsjfmlysdkzhr.supabase.co";
const FALLBACK_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc2Z4aGxic2pmbWx5c2RremhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODQzNTgsImV4cCI6MjA5NDA2MDM1OH0.GQ5cVfT064M6Hgml5r3T0ryvkO43wKBSricEMixtedY";

export const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? FALLBACK_URL;

export const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  FALLBACK_ANON;

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

/**
 * Uma leitura é considerada "bloqueada por RLS" quando a Data API retorna erro
 * (permission denied) OU quando retorna zero linhas (política nega todas as
 * linhas para o papel anônimo).
 */
export function isReadBlocked(result: { data: unknown[] | null; error: unknown }): boolean {
  if (result.error) return true;
  return Array.isArray(result.data) && result.data.length === 0;
}
