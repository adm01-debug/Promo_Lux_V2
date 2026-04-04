import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PasswordInput } from "@/components/lux/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/lux/auth/PasswordStrengthMeter";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const handleRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsValidSession(true);
      setChecking(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    handleRecovery();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: "Senha fraca", description: "A senha deve ter pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setIsSuccess(true);
        toast({ title: "Senha alterada ✅", description: "Sua senha foi redefinida com sucesso." });
        setTimeout(() => navigate("/"), 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Carregando">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 w-full max-w-sm space-y-6 text-center" role="main">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Este link de redefinição expirou ou é inválido. Solicite um novo link na tela de login.
            </p>
          </div>
          <Button onClick={() => navigate("/login")} className="w-full" size="lg">
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 w-full max-w-sm space-y-6 text-center" role="status">
          <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground mt-2">Redirecionando para o painel...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 w-full max-w-sm space-y-6" role="main">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Nova senha</h1>
            <p className="text-sm text-muted-foreground mt-1">Defina sua nova senha abaixo.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            id="new-password"
            label="Nova senha (mín. 8 caracteres)"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
          />
          <PasswordStrengthMeter password={password} />

          <PasswordInput
            id="confirm-password"
            label="Confirmar senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={8}
          />

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive" role="alert">As senhas não coincidem.</p>
          )}

          <Button type="submit" disabled={isSubmitting || !password || !confirmPassword} className="w-full gap-2" size="lg">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Redefinir senha
          </Button>
        </form>
      </div>
    </div>
  );
}
