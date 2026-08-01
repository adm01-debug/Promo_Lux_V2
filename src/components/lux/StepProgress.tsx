import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface StepProgressProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const StepProgress = ({ steps, currentStep, className = "" }: StepProgressProps) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isComplete
                    ? "hsl(var(--primary))"
                    : isCurrent
                    ? "hsl(var(--primary) / 0.3)"
                    : "hsl(var(--muted))",
                }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors"
                style={{
                  borderColor: isComplete || isCurrent
                    ? "hsl(var(--primary))"
                    : "hsl(var(--border))",
                }}
              >
                {isComplete ? (
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                ) : (
                  <span className={isCurrent ? "text-primary" : "text-muted-foreground"}>
                    {i + 1}
                  </span>
                )}
              </motion.div>
              <span className={`text-[10px] text-center leading-tight max-w-[60px] ${
                isCurrent ? "text-primary font-medium" : isComplete ? "text-foreground" : "text-muted-foreground"
              }`}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-1 mt-[-14px]">
                <motion.div
                  initial={false}
                  animate={{ scaleX: isComplete ? 1 : 0 }}
                  className="h-full bg-primary origin-left"
                  transition={{ duration: 0.3 }}
                />
                <div className="h-full bg-border -mt-px" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface ActionFeedbackProps {
  message: string;
  type?: "success" | "info" | "warning";
  visible: boolean;
}

export const ActionFeedback = ({ message, type = "success", visible }: ActionFeedbackProps) => {
  if (!visible) return null;

  const colors = {
    success: "bg-success/20 text-success border-success/30",
    info: "bg-primary/20 text-primary border-primary/30",
    warning: "bg-warning/20 text-warning border-warning/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-lg ${colors[type]}`}
    >
      {type === "success" && <Check className="h-4 w-4 inline mr-2" />}
      {message}
    </motion.div>
  );
};
