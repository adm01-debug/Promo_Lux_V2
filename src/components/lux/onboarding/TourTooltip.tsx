import { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "./TourSteps";
import type { TooltipPosition } from "./tour-position";


interface TourTooltipProps {
  step: number;
  totalSteps: number;
  current: TourStep;
  position: TooltipPosition | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onAction?: () => void;
}

const arrowClasses: Record<string, string> = {
  top: "left-1/2 -translate-x-1/2 -top-2 border-l-transparent border-r-transparent border-t-transparent border-b-[hsl(var(--card))]",
  bottom: "left-1/2 -translate-x-1/2 -bottom-2 border-l-transparent border-r-transparent border-b-transparent border-t-[hsl(var(--card))]",
  left: "top-1/2 -translate-y-1/2 -left-2 border-t-transparent border-b-transparent border-l-transparent border-r-[hsl(var(--card))]",
  right: "top-1/2 -translate-y-1/2 -right-2 border-t-transparent border-b-transparent border-r-transparent border-l-[hsl(var(--card))]",
};

export const TourTooltip = forwardRef<HTMLDivElement, TourTooltipProps>(
  ({ step, totalSteps, current, position, onNext, onPrev, onSkip, onAction }, ref) => {
    const isLast = step === totalSteps - 1;
    const isFirst = step === 0;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed z-[201] w-[360px] max-w-[90vw]"
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
            <div className={`absolute w-0 h-0 border-[8px] ${arrowClasses[position.arrowSide]}`} />
          )}

          {/* Header gradient */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

          <div className="p-5">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isLast ? (
                  <PartyPopper className="h-4 w-4 text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Passo {step + 1} de {totalSteps}
                </span>
              </div>
              <button
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
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
                onClick={onPrev}
                disabled={isFirst}
                className="text-xs gap-1"
              >
                <ChevronLeft className="h-3 w-3" />
                Anterior
              </Button>

              <div className="flex gap-2">
                {current.actionLabel && onAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAction}
                    className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {current.actionLabel}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="text-xs text-muted-foreground"
                >
                  Pular
                </Button>
                <Button
                  size="sm"
                  onClick={onNext}
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
    );
  }
);

TourTooltip.displayName = "TourTooltip";
