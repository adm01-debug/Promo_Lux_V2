import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function AuthLogo() {
  return (
    <div className="text-center space-y-3">
      <div className="flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative"
        >
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center glow-primary relative overflow-hidden">
            <Sparkles className="h-7 w-7 text-primary relative z-10" />
            {/* Inner shimmer */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
              aria-hidden="true"
            />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1 rounded-xl border border-primary/20"
            aria-hidden="true"
          />
        </motion.div>
      </div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          LUX <span className="text-primary glow-text">IA</span>
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1 tracking-wide">
          Sales Intelligence Platform
        </p>
      </motion.div>
    </div>
  );
}
