import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Sparkles, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRateLimit } from "@/hooks/useRateLimit";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { checkAndRecord, isLocked } = useRateLimit({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 });
  const [lockMsg, setLockMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    const status = checkAndRecord();
    if (status.locked) {
      const msg = `Muitas tentativas. Tente novamente em ${status.remainingSec}s.`;
      setLockMsg(msg);
      toast({ title: "Login bloqueado", description: msg, variant: "destructive" });
      return;
    }
    setLockMsg(null);

    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Erro no login", description: String(error), variant: "destructive" });
    }
  };

  const locked = isLocked();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            LUX <span className="text-primary glow-text">IA</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sales Intelligence Platform</p>
        </div>

        {(lockMsg || locked.locked) && (
          <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>{lockMsg || `Bloqueado. Tente em ${locked.remainingSec}s.`}</span>
          </div>
        )}

        <Button onClick={handleGoogleLogin} disabled={locked.locked} className="w-full gap-2" size="lg">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar com Google
        </Button>
        <p className="text-xs text-muted-foreground">
          Ao entrar, você concorda com nossos termos de uso.
        </p>
      </div>
    </div>
  );
}
