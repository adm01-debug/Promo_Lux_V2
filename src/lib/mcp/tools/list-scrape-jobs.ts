import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabase";

/**
 * Lista os jobs de raspagem (Google Maps / web) da organização do usuário,
 * com o status atual de cada execução.
 */
export default defineTool({
  name: "list_scrape_jobs",
  title: "Listar jobs de raspagem",
  description:
    "Lista os jobs de raspagem de leads mais recentes com status, origem e quantidade de resultados.",
  inputSchema: {
    status: z
      .enum(["pending", "running", "working", "completed", "failed", "cancelled"])
      .optional()
      .describe("Filtra os jobs por status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(15)
      .describe("Quantidade máxima de jobs retornados (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Não autenticado.");

    try {
      let query = supabaseForUser(ctx)
        .from("scrape_jobs")
        .select(
          "id,name,status,source,results_count,error_message,started_at,completed_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit ?? 15);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return toolError(`Falha ao listar jobs: ${error.message}`);

      const jobs = data ?? [];
      return {
        content: [
          {
            type: "text" as const,
            text:
              jobs.length === 0
                ? "Nenhum job de raspagem encontrado."
                : JSON.stringify(jobs, null, 2),
          },
        ],
        structuredContent: { count: jobs.length, jobs },
      };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  },
});
