import { motion, AnimatePresence } from "framer-motion";
import { Save, X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickySaveBarProps {
  isVisible: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  message?: string;
  saveLabel?: string;
}

export const StickySaveBar = ({
  isVisible,
  isSaving,
  onSave,
  onCancel,
  message = "Você tem alterações não salvas",
  saveLabel = "Salvar Alterações",
}: StickySaveBarProps) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
        >
          <div className="glass rounded-2xl border border-primary/20 shadow-2xl shadow-black/40 p-3 pl-5 flex items-center justify-between gap-4 backdrop-blur-xl bg-background/80 ring-1 ring-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground hidden sm:block">
                {message}
              </p>
              <p className="text-sm font-medium text-foreground sm:hidden">
                Alterações pendentes
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 h-9"
                onClick={onCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Descartar
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Salvando..." : saveLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
