import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  opacity: number;
}

const GOLD_COLORS = [
  "#D4A520", "#FFD700", "#F5C842", "#C9A94E",
  "#E8C547", "#B8860B", "#FFC125", "#DAA520",
];

export function GoldConfetti({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const count = 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 14 - 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: Math.random() * 6 + 3,
        color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 120;

    const animate = () => {
      frame++;
      if (frame > maxFrames) {
        onComplete?.();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.vy += 0.25;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - frame / maxFrames);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, [onComplete]);

  return (
    <motion.canvas
      ref={canvasRef}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] pointer-events-none"
      aria-hidden="true"
    />
  );
}
