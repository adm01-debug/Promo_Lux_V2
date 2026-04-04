import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "lux-onboarding-done";

interface TourStep {
  title: string;
  description: string;
  tip: string;
  /** CSS selector for the target element to highlight */
  target?: string;
  /** Tooltip placement relative to target */
  placement?: "bottom" | "right" | "top" | "left";
}

const tourSteps: TourStep[] = [
  {
    title: "Bem-vindo ao LUX IA! 🚀",
    description: "Sua plataforma de inteligência de vendas com automação completa.",
    tip: "Vamos fazer um tour rápido pelas funcionalidades principais.",
  },
  {
    title: "Navegação Principal",
    description: "Use o sidebar para acessar todas as seções da plataforma.",
    tip: "Passe o mouse nos itens para ver os atalhos de teclado.",
    target: "[aria-label='Navegação principal']",
    placement: "right",
  },
  {
    title: "Dashboard Inteligente",
    description: "Acompanhe métricas em tempo real: empresas raspadas, qualificadas e seus workflows.",
    tip: "Use Alt+1 para acessar o Dashboard rapidamente.",
    target: "[data-tour='dashboard']",
    placement: "right",
  },
  {
    title: "Workflows de Automação",
    description: "Crie pipelines que raspam, enriquecem e qualificam empresas automaticamente.",
    tip: "Google Maps → Enriquecimento → IPC — tudo em um clique.",
    target: "[data-tour='workflows']",
    placement: "right",
  },
  {
    title: "Busca Rápida ⌘K",
    description: "Use Cmd+K (ou Ctrl+K) para navegar rapidamente entre seções.",
    tip: "Funciona de qualquer lugar na plataforma!",
    target: "[data-tour='search']",
    placement: "bottom",
  },
  {
    title: "Tema & Notificações",
    description: "Alterne entre tema claro e escuro, e acompanhe notificações em tempo real.",
    tip: "Clique no ícone de sol/lua para alternar o tema.",
    target: "[data-tour='header-actions']",
    placement: "bottom",
  },
  {
    title: "Tudo Pronto! ✨",
    description: "Explore livremente. Use os atalhos Alt+1 a Alt+9 para navegação rápida.",
    tip: "Dica: passe o mouse nos itens do sidebar para ver os atalhos.",
  },
];

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

function getTooltipPosition(
  targetRect: DOMRect,
  placement: TourStep["placement"] = "bottom",
  tooltipWidth = 340,
  tooltipHeight = 220
): TooltipPosition {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  let arrowSide: TooltipPosition["arrowSide"] = "top";

  switch (placement) {
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.right + gap;
      arrowSide = "left";
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - tooltipWidth - gap;
      arrowSide = "right";
      break;
    case "top":
      top = targetRect.top - tooltipHeight - gap;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      arrowSide = "bottom";
      break;
    case "bottom":
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      arrowSide = "top";
      break;
  }

  // Clamp to viewport
  top = Math.max(8, Math.min(top, vh - tooltipHeight - 8));
  left = Math.max(8, Math.min(left, vw - tooltipWidth - 8));

  return { top, left, arrowSide };
}

export const OnboardingTour = forwardRef<HTMLDivElement>((_, _ref) => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const current = tourSteps[step];
    if (!current.target) {
      setPosition(null);
      setHighlightRect(null);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      setPosition(null);
      setHighlightRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);
    setPosition(getTooltipPosition(rect, current.placement));
  }, [step]);

  useEffect(() => {
    if (!show) return;
    // Small delay so DOM elements can settle after lazy loads
    const raf = requestAnimationFrame(() => updatePosition());
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
    };
  }, [show, step, updatePosition]);

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setShow(false);
  };

  const handleNext = () => {
    if (step < tourSteps.length - 1) setStep(step + 1);
    else handleComplete();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target && !!highlightRect;

  const arrowClasses: Record<string, string> = {
    top: "left-1/2 -translate-x-1/2 -top-2 border-l-transparent border-r-transparent border-t-transparent border-b-[hsl(var(--card))]",
    bottom: "left-1/2 -translate-x-1/2 -bottom-2 border-l-transparent border-r-transparent border-b-transparent border-t-[hsl(var(--card))]",
    left: "top-1/2 -translate-y-1/2 -left-2 border-t-transparent border-b-transparent border-l-transparent border-r-[hsl(var(--card))]",
    right: "top-1/2 -translate-y-1/2 -right-2 border-t-transparent border-b-transparent border-r-transparent border-l-[hsl(var(--card))]",
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with spotlight cutout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] pointer-events-auto"
            onClick={handleComplete}
            style={{
              background: hasTarget
                ? undefined
                : "rgba(0,0,0,0.6)",
            }}
          >
            {hasTarget && highlightRect && (
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <mask id="tour-spotlight">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    <rect
                      x={highlightRect.left - 6}
                      y={highlightRect.top - 6}
                      width={highlightRect.width + 12}
                      height={highlightRect.height + 12}
                      rx="12"
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.6)"
                  mask="url(#tour-spotlight)"
                />
              </svg>
            )}

            {/* Highlight border ring */}
            {hasTarget && highlightRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute rounded-xl border-2 border-primary/60 pointer-events-none"
                style={{
                  top: highlightRect.top - 6,
                  left: highlightRect.left - 6,
                  width: highlightRect.width + 12,
                  height: highlightRect.height + 12,
                  boxShadow: "0 0 24px -4px hsl(var(--primary) / 0.3)",
                }}
              />
            )}
          </motion.div>

          {/* Tooltip card */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed z-[201] w-[340px] max-w-[90vw]"
            style={
              position
                ? { top: position.top, left: position.left }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-2xl relative">
              {/* Arrow */}
              {position && (
                <div
                  className={`absolute w-0 h-0 border-[8px] ${arrowClasses[position.arrowSide]}`}
                />
              )}

              {/* Header gradient */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

              <div className="p-5">
                {/* Step counter */}
                <div className="flex items-center justify-between mb-3">
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
                <div className="flex gap-1.5 mb-4">
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
                    <h3 className="text-base font-bold text-foreground mb-1.5">
                      {current.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">
                      {current.description}
                    </p>
                    <div className="rounded-lg px-3 py-2 text-xs text-primary/80 bg-primary/5 border border-primary/15">
                      💡 {current.tip}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between mt-5">
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
});
OnboardingTour.displayName = "OnboardingTour";
