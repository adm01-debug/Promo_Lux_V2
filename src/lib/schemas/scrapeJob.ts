import { z } from "zod";

export const scrapeJobSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"),
  keywords: z.string().min(1, "Palavras-chave são obrigatórias").max(500, "Máximo 500 caracteres"),
  lang: z.enum(["pt", "en", "es"], { message: "Idioma inválido" }),
  radius: z.number().min(500, "Mínimo 500m").max(50000, "Máximo 50km"),
  depth: z.number().min(1, "Mínimo 1").max(5, "Máximo 5"),
  email: z.boolean(),
  fast_mode: z.boolean(),
});

export type ScrapeJobFormData = z.infer<typeof scrapeJobSchema>;

export function validateScrapeJob(data: ScrapeJobFormData) {
  const result = scrapeJobSchema.safeParse(data);
  if (result.success) return { success: true as const, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return { success: false as const, errors };
}
