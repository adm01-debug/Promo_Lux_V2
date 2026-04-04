import { Mail, Sparkles } from "lucide-react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AuthLogo } from "@/components/lux/auth/AuthLogo";
import { EmailInput } from "@/components/lux/auth/EmailInput";
import { PasswordInput } from "@/components/lux/auth/PasswordInput";
import { GoogleLoginButton } from "@/components/lux/auth/GoogleLoginButton";
import { ForgotPasswordOverlay } from "@/components/lux/auth/ForgotPasswordOverlay";
import { RateLimitWarning } from "@/components/lux/auth/RateLimitWarning";
import { PasswordStrengthMeter } from "@/components/lux/auth/PasswordStrengthMeter";

interface LoginCardProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isSubmitting: boolean;
  authTab: "login" | "signup";
  setAuthTab: (v: "login" | "signup") => void;
  showForgotPassword: boolean;
  setShowForgotPassword: (v: boolean) => void;
  resetEmail: string;
  setResetEmail: (v: string) => void;
  googleLoading: boolean;
  locked: { locked: boolean; remainingSec: number };
  rateLimitMsg: string | null;
  handleGoogleLogin: () => void;
  handleEmailLogin: (e: React.FormEvent) => void;
  handleEmailSignup: (e: React.FormEvent) => void;
  handleForgotPassword: (e: React.FormEvent) => void;
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export function LoginCard(props: LoginCardProps) {
  const {
    email, setEmail, password, setPassword,
    isSubmitting, authTab, setAuthTab,
    showForgotPassword, setShowForgotPassword,
    resetEmail, setResetEmail, googleLoading,
    locked, rateLimitMsg,
    handleGoogleLogin, handleEmailLogin, handleEmailSignup, handleForgotPassword,
  } = props;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="glass rounded-2xl p-8 w-full max-w-sm space-y-6 relative z-10 border border-border/30 shadow-2xl shadow-primary/5"
      role="main"
      aria-label="Formulário de autenticação"
    >
      <motion.div variants={fadeUp}>
        <AuthLogo />
      </motion.div>

      {rateLimitMsg && (
        <motion.div variants={fadeUp}>
          <RateLimitWarning message={rateLimitMsg} />
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <GoogleLoginButton onClick={handleGoogleLogin} disabled={locked.locked || googleLoading} loading={googleLoading} />
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Separator className="bg-border/30" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] uppercase tracking-widest text-muted-foreground select-none">
          ou
        </span>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "login" | "signup")} className="w-full">
          <TabsList className="w-full bg-secondary/50">
            <TabsTrigger value="login" className="flex-1 text-xs">Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 text-xs">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <EmailInput id="login-email" value={email} onChange={setEmail} />
              <PasswordInput id="login-password" label="Senha" value={password} onChange={setPassword} />
              <Button type="submit" disabled={locked.locked || isSubmitting} className="w-full gap-2 h-11" size="lg">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Entrar
              </Button>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setResetEmail(email); }}
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center py-1"
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
              <Button type="submit" disabled={locked.locked || isSubmitting} className="w-full gap-2 h-11" size="lg">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Criar Conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </motion.div>

      <motion.p variants={fadeUp} className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
        Ao entrar, você concorda com nossos termos de uso.
      </motion.p>

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
    </motion.div>
  );
}
