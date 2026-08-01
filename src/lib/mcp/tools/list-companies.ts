import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabase";

/**
 * Lista empresas do CRM visíveis para o usuário autenticado.
 * O isolamento por organização é garantido pelas políticas RLS da tabela
 * `companies` — nenhuma filtragem de segurança é feita no cliente.
 */
export default defineTool({
  name: "list_companies",
  title: "Listar empresas",
  description:
    "Lista empresas da base de prospecção do usuário, com busca opcional por nome, setor ou cidade.",
  inputSchema: {
    search: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe("Texto para buscar no nome da empresa."),
    sector: z.string().trim().max(80).optional().describe("Filtra por setor exato."),
    min_ipc_score: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Score IPC mínimo (0-100)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Quantidade máxima de empresas retornadas (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (
    { search, sector, min_ipc_score, limit },
    ctx: ToolContext,
  ) => {
    if (!ctx.isAuthenticated()) return toolError("Não autenticado.");

    try {
      let query = supabaseForUser(ctx)
        .from("companies")
        .select(
          "id,name,sector,location,website,phone,email,cnpj,ipc_score,enriched,starred,created_at",
        )
        .is("deleted_at", null)
        .order("ipc_score", { ascending: false, nullsFirst: false })
        .limit(limit ?? 20);

      if (search) query = query.ilike("name", `%${search}%`);
      if (sector) query = query.eq("sector", sector);
      if (typeof min_ipc_score === "number") {
        query = query.gte("ipc_score", min_ipc_score);
      }

      const { data, error } = await query;
      if (error) return toolError(`Falha ao listar empresas: ${error.message}`);

      const companies = data ?? [];
      return {
        content: [
          {
            type: "text" as const,
            text:
              companies.length === 0
                ? "Nenhuma empresa encontrada com esses filtros."
                : JSON.stringify(companies, null, 2),
          },
        ],
        structuredContent: { count: companies.length, companies },
      };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  },
});
