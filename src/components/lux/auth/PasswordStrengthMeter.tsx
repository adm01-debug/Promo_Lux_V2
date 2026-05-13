import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Check, X, AlertTriangle } from "lucide-react";

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

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "Mín. 8 caracteres", test: (pw) => pw.length >= 8 },
  { label: "Letra maiúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Número", test: (pw) => /[0-9]/.test(pw) },
  { label: "Caractere especial", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
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
      className="space-y-2"
      aria-live="polite"
    >
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-full ${i <= score ? info.barColor : "bg-muted/20"}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1, opacity: i <= score ? 1 : 0.3 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
            style={{ transformOrigin: "left" }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {requirements.map((req) => {
            const met = req.test(password);
            return (
              <motion.span
                key={req.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-0.5 text-[9px] transition-colors duration-200 ${
                  met ? "text-emerald-400" : "text-muted-foreground/50"
                }`}
              >
                {met ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                {req.label}
              </motion.span>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={score}
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-1 flex-shrink-0 ${info.colorClass}`}
          >
            <Icon className="h-3 w-3" />
            <span className="text-[10px] font-medium">{info.label}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {score < 3 && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 p-2 rounded bg-destructive/10 border border-destructive/20"
        >
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <p className="text-[10px] text-destructive leading-tight">
            Senha muito simples. Use caracteres variados para proteger sua conta multi-tenant.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

