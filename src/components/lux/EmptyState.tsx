import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Single action — backward compat */
  actionLabel?: string;
  onAction?: () => void;
  /** Multiple guided actions */
  actions?: EmptyStateAction[];
  /** Optional step hints for onboarding */
  steps?: string[];
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actions,
  steps,
}: EmptyStateProps) => {
  const allActions: EmptyStateAction[] = actions
    ? actions
    : actionLabel && onAction
      ? [{ label: actionLabel, onClick: onAction }]
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Animated icon with pulsing ring */}
      <div className="relative mb-6">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center"
        >
          <Icon className="h-10 w-10 text-primary/70" />
        </motion.div>
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping opacity-20" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>

      {/* Step hints */}
      {steps && steps.length > 0 && (
        <div className="mt-5 flex flex-col gap-2 text-left max-w-sm w-full">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3 glass rounded-lg px-4 py-2.5"
            >
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-foreground">{step}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {allActions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {allActions.map((action, i) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              variant={action.variant || (i === 0 ? "default" : "outline")}
              size="sm"
              className="gap-2"
            >
              {action.label}
              {i === 0 && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
};
