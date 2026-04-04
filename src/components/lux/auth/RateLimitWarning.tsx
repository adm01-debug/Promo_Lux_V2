import { ShieldAlert } from "lucide-react";

interface RateLimitWarningProps {
  message: string;
}

export function RateLimitWarning({ message }: RateLimitWarningProps) {
  return (
    <div
      className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3"
      role="alert"
    >
      <ShieldAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
