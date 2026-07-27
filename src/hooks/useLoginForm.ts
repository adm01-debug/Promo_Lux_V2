import { useState, useCallback } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useRateLimit } from "@/hooks/useRateLimit";
import { toast } from "@/hooks/use-toast";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";

/**
 * Destino pós-autenticação. Quando o usuário chega ao login vindo da tela de
 * consentimento OAuth (`/login?next=/.lovable/oauth/consent?...`), TODOS os
 * métodos precisam devolvê-lo àquela URL — inclusive o round-trip do Google.
 * Sem isso o cliente MCP cai na home e a conexão falha silenciosamente.
 * O valor é validado como caminho relativo same-origin (anti open redirect).
 */
function postAuthRedirect(): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return `${window.location.origin}${raw}`;
  }
  return window.location.origin;
}

export function useLoginForm() {
  const { checkAndRecord, isLocked, checkServerRateLimit } = useRateLimit("login", { maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 });
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerShake = useCallback(() => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  }, []);

  const locked = isLocked();

  const guardRate = async () => {
    // 1. Check local storage first (instant)
    const status = checkAndRecord();
    if (status.locked) {
      const msg = `Muitas tentativas. Tente novamente em ${status.remainingSec}s.`;
      setLockMsg(msg);
      toast({ title: "Acesso bloqueado", description: msg, variant: "destructive" });
      return true;
    }

    // 2. Check server-side for stronger enforcement
    if (email) {
      const isServerLocked = await checkServerRateLimit(email);
      if (isServerLocked) {
        const msg = "Acesso temporariamente bloqueado por segurança (servidor).";
        setLockMsg(msg);
        toast({ title: "Segurança: Bloqueio Ativo", description: msg, variant: "destructive" });
        return true;
      }
    }

    setLockMsg(null);
    return false;
  };

  const handleGoogleLogin = async () => {
    if (await guardRate()) return;
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: postAuthRedirect(),
    });
    if (result.error) {
      setGoogleLoading(false);
      toast({ title: "Erro no login", description: String(result.error), variant: "destructive" });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await guardRate()) return;

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      triggerShake();
      toast({ title: "Dados inválidos", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: result.data.email, password: result.data.password });
      if (error) {
        triggerShake();
        toast({ title: "Erro no login", description: error.message, variant: "destructive" });
      } else {
        setShowConfetti(true);
        toast({ title: "Bem-vindo de volta! 🎉", description: "Login realizado com sucesso." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await guardRate()) return;

    const result = signupSchema.safeParse({ email, password });
    if (!result.success) {
      triggerShake();
      toast({ title: "Dados inválidos", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: { emailRedirectTo: postAuthRedirect() },
      });
      if (error) {
        triggerShake();
        toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Verifique seu email ✉️",
          description: "Enviamos um link de confirmação para " + result.data.email,
        });
        setAuthTab("login");
        setPassword("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await guardRate()) return;
    const trimmed = resetEmail.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Email enviado ✉️",
          description: "Verifique sua caixa de entrada para redefinir a senha.",
        });
        setShowForgotPassword(false);
        setResetEmail("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const rateLimitMsg = lockMsg || (locked.locked ? `Bloqueado. Tente em ${locked.remainingSec}s.` : null);

  return {
    email, setEmail,
    password, setPassword,
    isSubmitting,
    authTab, setAuthTab,
    showForgotPassword, setShowForgotPassword,
    resetEmail, setResetEmail,
    googleLoading,
    locked,
    rateLimitMsg,
    shakeError,
    showConfetti, setShowConfetti,
    handleGoogleLogin,
    handleEmailLogin,
    handleEmailSignup,
    handleForgotPassword,
  };
}
