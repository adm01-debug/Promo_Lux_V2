import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate, useInView } from "framer-motion";

export const AnimatedCounter = ({ value, suffix = "", duration = 1.2 }: { value: number; suffix?: string; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const motionVal = useMotionValue(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString("pt-BR") + suffix;
      },
    });
    return () => controls.stop();
  }, [value, isInView, duration, motionVal, suffix]);

  return <span ref={containerRef}><span ref={ref}>0{suffix}</span></span>;
};
