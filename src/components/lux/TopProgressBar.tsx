import { forwardRef } from "react";
import { motion } from "framer-motion";

interface TopProgressBarProps {
  isAnimating: boolean;
}

export const TopProgressBar = forwardRef<HTMLDivElement, TopProgressBarProps>(
  ({ isAnimating }, ref) => {
    if (!isAnimating) return null;

    return (
      <div ref={ref} className="fixed top-0 left-0 right-0 z-[100] h-0.5">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    );
  }
);

TopProgressBar.displayName = "TopProgressBar";
