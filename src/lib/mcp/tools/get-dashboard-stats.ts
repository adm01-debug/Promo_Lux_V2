import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabase";

/**
 * Agregações do dashboard (empresas, leads, jobs, pipeline) para a
 * organização ativa. A RPC valida a associação do usuário à organização
 * internamente antes de agregar qualquer dado.
 */
export default defineTool({
  name: "get_dashboard_stats",
  title: "Estatísticas do dashboard",
  description:
    "Retorna as métricas consolidadas do dashboard (empresas, enriquecimento, jobs e pipeline) da organização ativa.",
  inputSchema: {
    organization_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Organização a consultar. Quando omitido, usa a organização padrão do usuário.",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ organization_id }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Não autenticado.");

    try {
      const supabase = supabaseForUser(ctx);

      let orgId = organization_id;
      if (!orgId) {
        const { data: defaultOrg, error: orgError } = await supabase.rpc(
          "default_org_for_current_user",
        );
        if (orgError) {
          return toolError(`Falha ao resolver organização: ${orgError.message}`);
        }
        orgId = (defaultOrg as string | null) ?? undefined;
      }

      if (!orgId) {
        return toolError("Nenhuma organização encontrada para este usuário.");
      }

      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: orgId,
      });
      if (error) return toolError(`Falha ao carregar estatísticas: ${error.message}`);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        structuredContent: { organization_id: orgId, stats: data },
      };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  },
});
