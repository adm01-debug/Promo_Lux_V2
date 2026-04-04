import { motion } from "framer-motion";
import type { ReactNode } from "react";

const variants = {
  initial: { opacity: 0, y: 16, scale: 0.97, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, scale: 0.98, filter: "blur(4px)" },
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  viewKey?: string;
}

export function PageTransition({ children, className, viewKey }: PageTransitionProps) {
  return (
    <motion.div
      key={viewKey}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.38,
        ease: [0.22, 1, 0.36, 1],
        opacity: { duration: 0.24 },
        filter: { duration: 0.3 },
        scale: { type: "spring", stiffness: 300, damping: 30 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
