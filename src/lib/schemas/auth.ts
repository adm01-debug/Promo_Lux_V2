import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "O email é obrigatório.")
    .email("Formato de email inválido.")
    .max(255, "Email muito longo."),
  password: z
    .string()
    .min(1, "A senha é obrigatória."),
});

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "O email é obrigatório.")
    .email("Formato de email inválido.")
    .max(255, "Email muito longo."),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres.")
    .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
    .regex(/[0-9]/, "A senha deve conter ao menos um número."),
});

export const resetEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "O email é obrigatório.")
    .email("Formato de email inválido."),
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres.")
    .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
    .regex(/[0-9]/, "A senha deve conter ao menos um número."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetEmailInput = z.infer<typeof resetEmailSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
