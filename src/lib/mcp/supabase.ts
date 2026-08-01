import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Cria um cliente Supabase que age COMO o usuário autenticado via OAuth.
 *
 * Regras de segurança inegociáveis:
 * - Nunca usar SUPABASE_SERVICE_ROLE_KEY aqui: as ferramentas MCP devem
 *   respeitar 100% das políticas RLS (isolamento multi-tenant por organização).
 * - O token bruto só é encaminhado ao Supabase; nunca é logado nem retornado.
 * - Env é lido dentro do handler (nunca no topo do módulo), porque o arquivo é
 *   avaliado em build-time e no cold start da edge function, onde não há env.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Configuração do backend indisponível para esta ferramenta.");
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resposta de erro padronizada para o cliente MCP. */
export function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Guarda de autenticação usada no início de todo handler. */
export function requireAuth(ctx: ToolContext): string | null {
  if (!ctx.isAuthenticated()) return null;
  return ctx.getUserId() ?? null;
}
