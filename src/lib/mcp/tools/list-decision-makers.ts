import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabase";

/**
 * Lista os decisores (contatos) já enriquecidos, opcionalmente filtrados por
 * empresa. Dados sensíveis de contato ficam protegidos por RLS por organização.
 */
export default defineTool({
  name: "list_decision_makers",
  title: "Listar decisores",
  description:
    "Lista contatos decisores enriquecidos (nome, cargo, empresa, LinkedIn) da base do usuário.",
  inputSchema: {
    company_name: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe("Filtra decisores pelo nome da empresa."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Quantidade máxima de contatos retornados (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_name, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Não autenticado.");

    try {
      let query = supabaseForUser(ctx)
        .from("lusha_contacts")
        .select(
          "id,full_name,job_title,company_name,linkedin_url,contact_source,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);

      if (company_name) query = query.ilike("company_name", `%${company_name}%`);

      const { data, error } = await query;
      if (error) return toolError(`Falha ao listar decisores: ${error.message}`);

      const contacts = data ?? [];
      return {
        content: [
          {
            type: "text" as const,
            text:
              contacts.length === 0
                ? "Nenhum decisor encontrado."
                : JSON.stringify(contacts, null, 2),
          },
        ],
        structuredContent: { count: contacts.length, contacts },
      };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  },
});
