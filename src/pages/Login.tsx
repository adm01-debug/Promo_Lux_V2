import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useRateLimit } from "@/hooks/useRateLimit";
import { toast } from "@/hooks/use-toast";
import { AuthLogo } from "@/components/lux/auth/AuthLogo";
import { EmailInput } from "@/components/lux/auth/EmailInput";
import { PasswordInput } from "@/components/lux/auth/PasswordInput";
import { GoogleLoginButton } from "@/components/lux/auth/GoogleLoginButton";
import { ForgotPasswordOverlay } from "@/components/lux/auth/ForgotPasswordOverlay";
import { RateLimitWarning } from "@/components/lux/auth/RateLimitWarning";
import { PasswordStrengthMeter } from "@/components/lux/auth/PasswordStrengthMeter";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { FloatingParticles } from "@/components/lux/auth/FloatingParticles";

export default function LoginPage() {
  const { checkAndRecord, isLocked } = useRateLimit({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 });
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const locked = isLocked();

  const guardRate = () => {
    const status = checkAndRecord();
    if (status.locked) {
      const msg = `Muitas tentativas. Tente novamente em ${status.remainingSec}s.`;
      setLockMsg(msg);
      toast({ title: "Acesso bloqueado", description: msg, variant: "destructive" });
      return true;
    }
    setLockMsg(null);
    return false;
  };

  const handleGoogleLogin = async () => {
    if (guardRate()) return;
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Erro no login", description: String(error), variant: "destructive" });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardRate()) return;

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Dados inválidos", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: result.data.email, password: result.data.password });
      if (error) {
        toast({ title: "Erro no login", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardRate()) return;

    const result = signupSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Dados inválidos", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
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
    if (guardRate()) return;
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" aria-hidden="true" />
      <FloatingParticles />
      <div className="glass rounded-2xl p-8 w-full max-w-sm space-y-6 relative z-10 border border-border/30 shadow-2xl shadow-primary/5" role="main">
        <AuthLogo />

        {rateLimitMsg && <RateLimitWarning message={rateLimitMsg} />}

        <GoogleLoginButton onClick={handleGoogleLogin} disabled={locked.locked} />

        <div className="relative">
          <Separator className="bg-border/30" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            ou
          </span>
        </div>

        <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "login" | "signup")} className="w-full">
          <TabsList className="w-full bg-secondary/50">
            <TabsTrigger value="login" className="flex-1 text-xs">Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 text-xs">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <EmailInput id="login-email" value={email} onChange={setEmail} />
              <PasswordInput id="login-password" label="Senha" value={password} onChange={setPassword} />
              <Button type="submit" disabled={locked.locked || isSubmitting} className="w-full gap-2" size="lg">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Entrar
              </Button>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setResetEmail(email); }}
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Esqueceu a senha?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <EmailInput id="signup-email" value={email} onChange={setEmail} />
              <PasswordInput
                id="signup-password"
                label="Senha (mín. 8 caracteres)"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={8}
              />
              <PasswordStrengthMeter password={password} />
              <Button type="submit" disabled={locked.locked || isSubmitting} className="w-full gap-2" size="lg">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Criar Conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Ao entrar, você concorda com nossos termos de uso.
        </p>

        {showForgotPassword && (
          <ForgotPasswordOverlay
            resetEmail={resetEmail}
            onResetEmailChange={setResetEmail}
            onSubmit={handleForgotPassword}
            onBack={() => setShowForgotPassword(false)}
            isSubmitting={isSubmitting}
            disabled={locked.locked}
          />
        )}
      </div>
    </div>
  );
}
