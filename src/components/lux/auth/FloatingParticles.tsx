import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  o: number;
  baseO: number;
}

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];
    const COUNT = 35;
    const MOUSE_RADIUS = 120;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    for (let i = 0; i < COUNT; i++) {
      const baseO = Math.random() * 0.35 + 0.1;
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.8 + 0.5,
        dx: (Math.random() - 0.5) * 0.25,
        dy: (Math.random() - 0.5) * 0.25,
        o: baseO,
        baseO,
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        // Mouse repel
        const dmx = p.x - mx;
        const dmy = p.y - my;
        const dm = Math.sqrt(dmx * dmx + dmy * dmy);
        if (dm < MOUSE_RADIUS && dm > 0) {
          const force = (1 - dm / MOUSE_RADIUS) * 1.5;
          p.x += (dmx / dm) * force;
          p.y += (dmy / dm) * force;
          p.o = Math.min(p.baseO + 0.3, 0.7);
        } else {
          p.o += (p.baseO - p.o) * 0.05;
        }

        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(45, 100%, 55%, ${p.o})`;
        ctx.fill();
      }

      // Draw connections (limited for perf)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < 10000) { // 100^2
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(45, 100%, 55%, ${0.06 * (1 - Math.sqrt(dist) / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ pointerEvents: "auto", zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
