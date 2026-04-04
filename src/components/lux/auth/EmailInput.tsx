import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function EmailInput({ id, value, onChange, autoFocus }: EmailInputProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Email
      </Label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          id={id}
          type="email"
          placeholder="seu@email.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 bg-secondary/30 border-border/30"
          required
          autoComplete="email"
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
