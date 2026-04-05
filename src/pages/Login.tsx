import { useLoginForm } from "@/hooks/useLoginForm";
import { FloatingParticles } from "@/components/lux/auth/FloatingParticles";
import { GoogleLoadingOverlay } from "@/components/lux/auth/GoogleLoadingOverlay";
import { LoginCard } from "@/components/lux/auth/LoginCard";
import { GoldConfetti } from "@/components/lux/auth/GoldConfetti";
import { AnimatePresence, motion } from "framer-motion";
import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const form = useLoginForm();
  const { enterDemo } = useDemo();
  const navigate = useNavigate();

  const handleDemo = () => {
    enterDemo();
    navigate("/");
  };

  return (
    <>
      {form.googleLoading && <GoogleLoadingOverlay />}
      <AnimatePresence>
        {form.showConfetti && (
          <GoldConfetti onComplete={() => form.setShowConfetti(false)} />
        )}
      </AnimatePresence>
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06)_0%,transparent_70%)]"
          aria-hidden="true"
        />
        {/* Top-right accent glow */}
        <motion.div
          animate={{ opacity: [0.04, 0.08, 0.04], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        {/* Bottom-left accent glow */}
        <motion.div
          animate={{ opacity: [0.03, 0.06, 0.03], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <FloatingParticles />

        <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-md">
          <LoginCard {...form} />

          {/* Demo mode button */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="w-full"
          >
            <Button
              variant="outline"
              className="w-full gap-2 glass border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all duration-300 group"
              onClick={handleDemo}
            >
              <Play className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span>Explorar em modo demonstração</span>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-auto">
                sem login
              </span>
            </Button>
          </motion.div>
        </div>

        {/* Footer branding */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute bottom-4 text-[10px] text-muted-foreground/40 tracking-widest uppercase select-none"
        >
          Powered by LUX IA
        </motion.p>
      </div>
    </>
  );
}
