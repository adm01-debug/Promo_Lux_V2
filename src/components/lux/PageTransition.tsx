import { motion, Variants } from "framer-motion";
import type { ReactNode } from "react";
import { itemVariants } from "./motion-variants";

const pageVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.97, filter: "blur(6px)" },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    filter: "blur(0px)",
    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.05,
      delayChildren: 0.1,
    }
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    scale: 0.98, 
    filter: "blur(4px)",
    transition: {
      duration: 0.25,
      ease: "easeIn"
    }
  },
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
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * MotionSection - Wrapper para elementos que devem ser animados sequencialmente
 */
export function MotionSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
