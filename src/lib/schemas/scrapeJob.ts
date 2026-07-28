import { z } from "zod";

export const scrapeJobSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"),
  keywords: z.string().min(1, "Palavras-chave são obrigatórias").max(500, "Máximo 500 caracteres"),
  lang: z.enum(["pt", "en", "es"], { message: "Idioma inválido" }),
  radius: z.number().min(500, "Mínimo 500m").max(50000, "Máximo 50km"),
  depth: z.number().min(1, "Mínimo 1").max(5, "Máximo 5"),
  email: z.boolean(),
  fast_mode: z.boolean(),
  auto_sync: z.boolean().default(false),
  // Alinhamento com o contrato do omkarcloud/google-maps-scraper.
  // Opcionais: ignorados pelo provedor padrão (gosom).
  country: z.string().length(2, "Use o código ISO de 2 letras").optional(),
  business_type: z.string().max(120, "Máximo 120 caracteres").optional(),
  max_cities: z.number().int().positive().max(10000).optional(),
  max_results: z.number().int().positive().max(100000).optional(),
  max_reviews: z.number().int().positive().max(500).optional(),
  reviews_sort: z
    .enum(["newest", "most_relevant", "highest_rating", "lowest_rating"])
    .optional(),
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
