import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"),
  sector: z.string().max(100, "Máximo 100 caracteres").optional().or(z.literal("")),
  location: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  email: z.union([
    z.string().email("Email inválido"),
    z.literal(""),
  ]).optional(),
  phone: z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
  website: z.union([
    z.string().url("URL inválida"),
    z.literal(""),
  ]).optional(),
  employees: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  revenue: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
});

export type CompanyFormData = z.infer<typeof companySchema>;

export function validateCompany(data: CompanyFormData): { success: true; data: CompanyFormData } | { success: false; errors: Record<string, string> } {
  const result = companySchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return { success: false, errors };
}
