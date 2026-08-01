import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function GoogleLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center gap-4"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </motion.div>
      <p className="text-sm text-muted-foreground animate-pulse">
        Redirecionando para o Google...
      </p>
    </motion.div>
  );
}
