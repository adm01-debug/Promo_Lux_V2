import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function AuthLogo() {
  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
          className="relative"
        >
          {/* Outer glow ring */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-3 rounded-2xl bg-primary/8 blur-xl"
            aria-hidden="true"
          />
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 relative overflow-hidden shadow-[0_0_30px_hsl(var(--primary)/0.15)]">
            <Sparkles className="h-8 w-8 text-primary relative z-10 drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
            {/* Shimmer sweep */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/25 to-transparent skew-x-12"
              aria-hidden="true"
            />
          </div>
          {/* Orbiting ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-2xl border border-dashed border-primary/15"
            aria-hidden="true"
          />
        </motion.div>
      </div>
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          LUX <span className="text-primary glow-text">IA</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5 tracking-[0.25em] uppercase font-medium">
          Sales Intelligence Platform
        </p>
      </motion.div>
    </div>
  );
}
