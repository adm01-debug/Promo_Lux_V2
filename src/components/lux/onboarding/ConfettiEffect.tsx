import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142 80% 50%)",
  "hsl(270 70% 60%)",
  "hsl(38 100% 55%)",
  "hsl(200 80% 60%)",
  "hsl(340 80% 60%)",
];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
}

export function ConfettiEffect({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const items: Particle[] = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      rotation: Math.random() * 720 - 360,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 6,
      delay: Math.random() * 0.5,
    }));
    setParticles(items);

    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                top: `${100 + Math.random() * 20}%`,
                rotate: p.rotation,
                opacity: 0,
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: p.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute rounded-sm"
              style={{
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
