import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"),
  prospects: z.number().min(0, "Mínimo 0").max(100000, "Máximo 100.000"),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

export function validateCampaign(data: { name: string; prospects: number }) {
  const result = campaignSchema.safeParse(data);
  if (result.success) return { success: true as const, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return { success: false as const, errors };
}
