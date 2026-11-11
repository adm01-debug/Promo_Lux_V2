import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface DataErrorProps {
  message?: string;
  onRetry?: () => void;
}

export const DataError = ({
  message = "Não foi possível carregar os dados.",
  onRetry,
}: DataErrorProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-12 px-6 text-center"
  >
    <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
      <AlertCircle className="h-7 w-7 text-destructive" />
    </div>
    <h3 className="text-sm font-semibold text-foreground mb-1">
      Erro ao carregar
    </h3>
    <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
    {onRetry && (
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className="mt-4 gap-2"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    )}
  </motion.div>
);
