import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabase";

/**
 * Retorna o detalhe completo de uma empresa, incluindo dados de
 * enriquecimento e presença digital. RLS garante que apenas empresas da
 * organização do usuário sejam acessíveis.
 */
export default defineTool({
  name: "get_company",
  title: "Detalhar empresa",
  description:
    "Retorna os dados completos de uma empresa específica pelo seu identificador.",
  inputSchema: {
    company_id: z.string().uuid().describe("Identificador (UUID) da empresa."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Não autenticado.");

    try {
      const { data, error } = await supabaseForUser(ctx)
        .from("companies")
        .select(
          "id,name,sector,location,website,phone,email,cnpj,employees,revenue,ipc_score,enriched,starred,description,linkedin_url,instagram_url,rating,review_count,business_status,google_maps_url,created_at,updated_at",
        )
        .eq("id", company_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) return toolError(`Falha ao buscar empresa: ${error.message}`);
      if (!data) {
        return toolError("Empresa não encontrada ou sem permissão de acesso.");
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        structuredContent: { company: data },
      };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  },
});
