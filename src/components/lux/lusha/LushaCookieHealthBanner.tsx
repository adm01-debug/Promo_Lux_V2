import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ShieldAlert, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LushaCookieHealth = {
  status: "healthy" | "expiring_soon" | "expired" | "error" | "unknown";
  message: string;
  days_since_update: number | null;
  expires_in_days: number | null;
};

/**
 * P1-7 — Banner de saúde do cookie Lusha.
 *
 * Comportamento:
 * - `healthy` ou `unknown` (vault não configurado): não renderiza nada.
 * - `expiring_soon`: banner âmbar (atenção).
 * - `expired` / `error`: banner vermelho (bloqueante/atenção crítica).
 *
 * Polling a cada 5 minutos; falhas silenciosas (não quebram o Oráculo).
 */
export function LushaCookieHealthBanner() {
  const { data } = useQuery<LushaCookieHealth>({
    queryKey: ["lusha", "cookie-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<LushaCookieHealth>(
        "lusha-cookie-health",
        { method: "GET" }
      );
      if (error) throw error;
      return data!;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  if (!data || data.status === "healthy" || data.status === "unknown") return null;

  const variant =
    data.status === "expiring_soon"
      ? {
          wrap: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
          Icon: Clock,
          label: "Cookie Lusha expirando",
        }
      : data.status === "expired"
        ? {
            wrap: "border-destructive/50 bg-destructive/10 text-destructive",
            Icon: ShieldAlert,
            label: "Cookie Lusha expirado",
          }
        : {
            wrap: "border-destructive/50 bg-destructive/10 text-destructive",
            Icon: AlertTriangle,
            label: "Cookie Lusha com erro",
          };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variant.wrap
      )}
    >
      <variant.Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        <p className="font-semibold">{variant.label}</p>
        <p className="text-xs opacity-90">{data.message}</p>
      </div>
    </div>
  );
}

// Utilitário exportado para reuso em outras telas se necessário
export const LushaCookieHealthOk = CheckCircle2;
