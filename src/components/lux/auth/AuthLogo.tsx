import { Sparkles } from "lucide-react";

export function AuthLogo() {
  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          LUX <span className="text-primary glow-text">IA</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sales Intelligence Platform
        </p>
      </div>
    </div>
  );
}
