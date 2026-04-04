import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[100] bg-destructive/95 backdrop-blur-md text-destructive-foreground text-center py-2 text-xs font-medium flex items-center justify-center gap-2"
          role="alert"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Sem conexão com a internet
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="h-3 w-3 opacity-60" />
          </motion.div>
        </motion.div>
      )}

      {showReconnected && online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[100] bg-success/95 backdrop-blur-md text-success-foreground text-center py-2 text-xs font-medium flex items-center justify-center gap-2"
          role="status"
        >
          <motion.div
            className="h-2 w-2 rounded-full bg-success-foreground"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.6, repeat: 2 }}
          />
          Conexão restaurada
        </motion.div>
      )}
    </AnimatePresence>
  );
}
