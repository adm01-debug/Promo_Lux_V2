import { motion } from "framer-motion";

interface TopProgressBarProps {
  isAnimating: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function TopProgressBar({ isAnimating, ref }: TopProgressBarProps) {
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
