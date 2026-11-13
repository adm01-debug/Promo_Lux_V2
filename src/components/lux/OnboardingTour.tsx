import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { tourSteps } from "./onboarding/TourSteps";
import { TourSpotlight } from "./onboarding/TourSpotlight";
import { TourTooltip } from "./onboarding/TourTooltip";
import { getTooltipPosition } from "./onboarding/tour-position";
import { ConfettiEffect } from "./onboarding/ConfettiEffect";

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

export const OnboardingTour = () => {
  const { shouldShow, loading, markCompleted } = useOnboardingState();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Delay showing to let page load
  useEffect(() => {
    if (!loading && shouldShow) {
      const timer = setTimeout(() => setActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading, shouldShow]);

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
    if (!active) return;
    const raf = requestAnimationFrame(() => updatePosition());
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
    };
  }, [active, step, updatePosition]);

  const handleComplete = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => {
      setActive(false);
      markCompleted();
    }, 600);
  }, [markCompleted]);

  const handleNext = useCallback(() => {
    if (step < tourSteps.length - 1) setStep((s) => s + 1);
    else handleComplete();
  }, [step, handleComplete]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const handleAction = useCallback(() => {
    const current = tourSteps[step];
    if (current.target === "[data-tour='search']") {
      // Trigger command palette
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true }),
      );
    }
    // For other action steps, just go next
    handleNext();
  }, [step, handleNext]);

  const handleSkip = useCallback(() => {
    setActive(false);
    markCompleted();
  }, [markCompleted]);

  const current = tourSteps[step];
  const hasTarget = !!current.target && !!highlightRect;

  return (
    <>
      <ConfettiEffect active={showConfetti} />

      <AnimatePresence>
        {active && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] pointer-events-auto"
              onClick={handleSkip}
              style={{
                background: hasTarget ? undefined : "rgba(0,0,0,0.6)",
              }}
            >
              {hasTarget && highlightRect && (
                <TourSpotlight rect={highlightRect} onClick={handleSkip} />
              )}
            </motion.div>

            {/* Tooltip */}
            <TourTooltip
              ref={tooltipRef}
              step={step}
              totalSteps={tourSteps.length}
              current={current}
              position={position}
              onNext={handleNext}
              onPrev={handlePrev}
              onSkip={handleSkip}
              onAction={current.actionLabel ? handleAction : undefined}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
};
