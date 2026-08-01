import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface RateLimitWarningProps {
  message: string;
}

export function RateLimitWarning({ message }: RateLimitWarningProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2.5 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-shake"
      role="alert"
      aria-live="assertive"
    >
      <ShieldAlert className="h-4 w-4 flex-shrink-0 animate-pulse" aria-hidden="true" />
      <span className="font-medium">{message}</span>
    </motion.div>
  );
}
