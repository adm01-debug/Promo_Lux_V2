import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

const strengthMap = [
  { score: 0, label: "", colorClass: "", barColor: "" },
  { score: 1, label: "Fraca", colorClass: "text-destructive", barColor: "bg-destructive", Icon: ShieldAlert },
  { score: 2, label: "Razoável", colorClass: "text-orange-400", barColor: "bg-orange-400", Icon: Shield },
  { score: 3, label: "Boa", colorClass: "text-yellow-400", barColor: "bg-yellow-400", Icon: Shield },
  { score: 4, label: "Forte", colorClass: "text-emerald-400", barColor: "bg-emerald-400", Icon: ShieldCheck },
  { score: 5, label: "Excelente", colorClass: "text-primary", barColor: "bg-primary", Icon: ShieldCheck },
];

function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 5);
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const score = useMemo(() => getStrength(password), [password]);
  const info = strengthMap[score];

  if (!password) return null;

  const Icon = info.Icon ?? Shield;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-1.5"
      aria-live="polite"
    >
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-full ${i <= score ? info.barColor : "bg-muted/20"}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: i <= score ? 1 : 1, opacity: i <= score ? 1 : 0.3 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
            style={{ transformOrigin: "left" }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={score}
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center justify-end gap-1 ${info.colorClass}`}
        >
          <Icon className="h-3 w-3" />
          <span className="text-[10px] font-medium">{info.label}</span>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
