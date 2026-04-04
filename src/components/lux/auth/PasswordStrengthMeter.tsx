import { useMemo } from "react";

interface PasswordStrengthMeterProps {
  password: string;
}

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Fraca", color: "bg-destructive" };
  if (score === 2) return { score: 2, label: "Razoável", color: "bg-orange-500" };
  if (score === 3) return { score: 3, label: "Boa", color: "bg-yellow-500" };
  if (score === 4) return { score: 4, label: "Forte", color: "bg-emerald-500" };
  return { score: 5, label: "Excelente", color: "bg-emerald-400" };
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { score, label, color } = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? color : "bg-muted/30"
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{label}</p>
    </div>
  );
}
