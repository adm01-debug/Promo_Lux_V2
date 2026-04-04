import { motion } from "framer-motion";
import type { ReactNode } from "react";

const variants = {
  initial: { opacity: 0, y: 12, scale: 0.98, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, scale: 0.99, filter: "blur(2px)" },
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /** Unique key for AnimatePresence (e.g. current view name) */
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
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
        opacity: { duration: 0.22 },
        filter: { duration: 0.25 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
