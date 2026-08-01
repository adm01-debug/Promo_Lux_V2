import { motion, AnimatePresence } from "framer-motion";

interface TopProgressBarProps {
  isAnimating: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function TopProgressBar({ isAnimating, ref }: TopProgressBarProps) {
  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          ref={ref}
          className="fixed top-0 left-0 right-0 z-[100] h-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/40 rounded-r-full"
            initial={{ width: "0%", opacity: 0.7 }}
            animate={{ width: "100%", opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          />
          <motion.div
            className="absolute right-0 top-0 h-full w-8 bg-primary/60 blur-md rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
