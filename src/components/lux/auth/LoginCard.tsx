import { Mail, Sparkles } from "lucide-react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  shakeError: boolean;
  handleGoogleLogin: () => void;
  handleEmailLogin: (e: React.FormEvent) => void;
  handleEmailSignup: (e: React.FormEvent) => void;
  handleForgotPassword: (e: React.FormEvent) => void;
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: "easeOut" as const } },
};

const tabSlide = {
  initial: { opacity: 0, x: 12, filter: "blur(3px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, x: -12, filter: "blur(3px)", transition: { duration: 0.15 } },
};

export function LoginCard(props: LoginCardProps) {
  const {
    email, setEmail, password, setPassword,
    isSubmitting, authTab, setAuthTab,
    showForgotPassword, setShowForgotPassword,
    resetEmail, setResetEmail, googleLoading,
    locked, rateLimitMsg, shakeError,
    handleGoogleLogin, handleEmailLogin, handleEmailSignup, handleForgotPassword,
  } = props;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`auth-card-glow glass rounded-2xl p-6 sm:p-8 w-full max-w-[380px] space-y-5 sm:space-y-6 relative z-10 border border-border/20 shadow-2xl shadow-primary/10 backdrop-blur-2xl ${shakeError ? "animate-shake" : ""}`}
      role="main"
      aria-label="Formulário de autenticação"
    >
      <motion.div variants={fadeUp}>
        <AuthLogo />
      </motion.div>

      <AnimatePresence>
        {rateLimitMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <RateLimitWarning message={rateLimitMsg} />
          </motion.div>
        )}
      </AnimatePresence>

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
            <TabsTrigger value="login" className="flex-1 text-xs font-medium">Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 text-xs font-medium">Criar Conta</TabsTrigger>
          </TabsList>

          <div className="mt-4 relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {authTab === "login" ? (
                <motion.div key="login" {...tabSlide}>
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
                </motion.div>
              ) : (
                <motion.div key="signup" {...tabSlide}>
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </motion.div>

      <motion.p variants={fadeUp} className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
        Ao entrar, você concorda com nossos{" "}
        <button type="button" className="underline underline-offset-2 hover:text-primary transition-colors duration-200 cursor-pointer">
          termos de uso
        </button>{" "}
        e{" "}
        <button type="button" className="underline underline-offset-2 hover:text-primary transition-colors duration-200 cursor-pointer">
          política de privacidade
        </button>.
      </motion.p>

      <AnimatePresence>
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
      </AnimatePresence>
    </motion.div>
  );
}
