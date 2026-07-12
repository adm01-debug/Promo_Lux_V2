import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface LuxImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: React.ReactNode;
}

/**
 * LuxImage
 * Implementa lazy loading com efeito de desfoque progressivo (blur-up)
 * e tratamento de erro elegante.
 */
export function LuxImage({ src, alt, className, fallbackIcon, ...props }: LuxImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
  }, [src]);

  if (error || !src) {
    return (
      <div className={cn("bg-secondary/50 flex items-center justify-center overflow-hidden", className)}>
        {fallbackIcon || <div className="text-muted-foreground/40 text-[10px] uppercase font-bold tracking-widest">N/A</div>}
      </div>
    );
  }

  // Remove motion-conflicting props from img attributes
  const { 
    onAnimationStart, onDrag, onDragEnd, onDragStart,
    // @ts-expect-error style pode conflitar entre motion e img
    style: motionStyle, 
    ...imgProps 
  } = props as any;

  return (
    <div className={cn("relative overflow-hidden bg-secondary/20", className)}>
      <AnimatePresence>
        {!loaded && (
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-muted/40 animate-pulse"
          />
        )}
      </AnimatePresence>
      <motion.img
        src={src}
        alt={alt}
        initial={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
        animate={loaded ? { opacity: 1, filter: "blur(0px)", scale: 1 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "w-full h-full object-cover",
          !loaded && "invisible"
        )}
        {...imgProps}
      />
    </div>
  );
}
