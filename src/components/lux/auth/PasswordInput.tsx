import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  placeholder = "••••••••",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5 group">
      <Label htmlFor={id} className="text-xs text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
        {label}
      </Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary/70 transition-colors duration-200" />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 pr-10 bg-secondary/30 border-border/30 focus:border-primary/50 focus:bg-secondary/50 transition-all duration-200 h-11"
          required
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 rounded-sm p-0.5",
            "text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground",
            "hover:bg-secondary/50"
          )}
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          <div className="relative h-4 w-4">
            <Eye className={cn("h-4 w-4 absolute inset-0 transition-all duration-200", showPassword ? "opacity-0 scale-75" : "opacity-100 scale-100")} />
            <EyeOff className={cn("h-4 w-4 absolute inset-0 transition-all duration-200", showPassword ? "opacity-100 scale-100" : "opacity-0 scale-75")} />
          </div>
        </button>
      </div>
    </div>
  );
}
