import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "lux-onboarding-done";

interface TourStep {
  title: string;
  description: string;
  tip: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Bem-vindo ao LUX IA! 🚀",
    description: "Sua plataforma de inteligência de vendas com automação completa.",
    tip: "Vamos fazer um tour rápido pelas funcionalidades principais.",
  },
  {
    title: "Dashboard Inteligente",
    description: "Acompanhe métricas em tempo real: empresas raspadas, qualificadas e seus workflows.",
    tip: "Use Alt+1 para acessar o Dashboard rapidamente.",
  },
  {
    title: "Configuração de IPC",
    description: "Defina seu Perfil de Cliente Ideal para qualificar empresas automaticamente.",
    tip: "Acesse via sidebar ou Alt+3.",
  },
  {
    title: "Workflows de Automação",
    description: "Crie pipelines que raspam, enriquecem e qualificam empresas automaticamente.",
    tip: "Google Maps → Enriquecimento → IPC — tudo em um clique.",
  },
  {
    title: "Busca Rápida ⌘K",
    description: "Use Cmd+K (ou Ctrl+K) para navegar rapidamente entre seções.",
    tip: "Funciona de qualquer lugar na plataforma!",
  },
  {
    title: "Tudo Pronto! ✨",
    description: "Explore livremente. Use os atalhos Alt+1 a Alt+9 para navegação rápida.",
    tip: "Dica: passe o mouse nos itens do sidebar para ver os atalhos.",
  },
];

export const OnboardingTour = () => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setShow(false);
  };

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;
  const isFirst = step === 0;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[200]"
            onClick={handleComplete}
          />

          {/* Tour card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90vw] max-w-md"
          >
            <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-2xl">
              {/* Header gradient */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

              <div className="p-6">
                {/* Step counter */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                      Passo {step + 1} de {tourSteps.length}
                    </span>
                  </div>
                  <button
                    onClick={handleComplete}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Fechar tour"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Progress dots */}
                <div className="flex gap-1.5 mb-5">
                  {tourSteps.map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-1 rounded-full flex-1"
                      animate={{
                        backgroundColor: i <= step ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      {current.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {current.description}
                    </p>
                    <div className="glass rounded-lg px-3 py-2 text-xs text-primary/80 border border-primary/20">
                      💡 {current.tip}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    disabled={isFirst}
                    className="text-xs gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Anterior
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleComplete}
                      className="text-xs text-muted-foreground"
                    >
                      Pular
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="text-xs gap-1"
                    >
                      {isLast ? (
                        <>
                          <Rocket className="h-3 w-3" />
                          Começar!
                        </>
                      ) : (
                        <>
                          Próximo
                          <ChevronRight className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
