import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

export const AnimatedDonut = ({
  percentage,
  size = 128,
  strokeWidth = 10,
  color = "hsl(var(--primary))",
  bgColor = "hsl(var(--secondary))",
  label,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  sublabel?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div ref={containerRef} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
        <motion.circle
          cx={center} cy={center} r={radius} fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={isInView ? { strokeDashoffset: circumference - (percentage / 100) * circumference } : {}}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-foreground">
          <AnimatedCounter value={percentage} suffix="%" duration={1.4} />
        </span>
        {label && <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export const MiniDonut = ({ percentage, color, size = 36 }: { percentage: number; color: string; size?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={3} />
        <motion.circle
          cx={center} cy={center} r={r} fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={isInView ? { strokeDashoffset: c - (percentage / 100) * c } : {}}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
};
