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
  actionLabel?: string;
  onAction?: () => void;
  actions?: EmptyStateAction[];
  steps?: string[];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: "easeOut" as const } },
};

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
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      {/* Animated icon with double ring */}
      <motion.div variants={fadeUp} className="relative mb-8">
        <motion.div
          animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/15 shadow-[0_0_30px_hsl(var(--primary)/0.1)]"
        >
          <Icon className="h-10 w-10 text-primary/80 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-3 rounded-2xl border border-primary/10"
          aria-hidden="true"
        />
      </motion.div>

      <motion.h3 variants={fadeUp} className="text-lg font-semibold text-foreground mb-1.5">
        {title}
      </motion.h3>
      <motion.p variants={fadeUp} className="text-sm text-muted-foreground max-w-md leading-relaxed">
        {description}
      </motion.p>

      {/* Step hints */}
      {steps && steps.length > 0 && (
        <motion.div variants={fadeUp} className="mt-6 flex flex-col gap-2.5 text-left max-w-sm w-full">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, ease: "easeOut" }}
              className="flex items-center gap-3 glass rounded-xl px-4 py-3 border border-border/30 hover:border-primary/20 transition-colors duration-200"
            >
              <span className="h-7 w-7 rounded-lg bg-primary/12 text-primary text-xs font-bold flex items-center justify-center shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                {i + 1}
              </span>
              <span className="text-sm text-foreground">{step}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Action buttons */}
      {allActions.length > 0 && (
        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-2 justify-center">
          {allActions.map((action, i) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              variant={action.variant || (i === 0 ? "default" : "outline")}
              size="sm"
              className={cn("gap-2", i === 0 && "shadow-[0_0_16px_hsl(var(--primary)/0.2)]")}
            >
              {action.label}
              {i === 0 && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};
