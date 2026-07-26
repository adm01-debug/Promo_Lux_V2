import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface BlockedStreak {
  queue_kind: string;
  blocked_runs: number;
  blocked_days: number | string;
  first_blocked_at: string | null;
  last_reason: string | null;
}

const LABELS: Record<string, string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

/** Limite de execuções consecutivas bloqueadas antes de tratar como alerta. */
const ALERT_THRESHOLD = 3;

function fmtDays(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)} dia${n >= 2 ? "s" : ""}`;
}

/**
 * Alerta operacional: filas cujo auto-ajuste de SLA está travado
 * por amostra insuficiente há várias execuções consecutivas.
 */
export function SlaAutoTuneBlockedCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sla-autotune-blocked-streaks"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sla_autotune_blocked_streaks");
      if (error) throw error;
      return (data ?? []) as BlockedStreak[];
    },
    staleTime: 60_000,
    retry: false,
  });

  const rows = data ?? [];
  const alerts = rows.filter((r) => Number(r.blocked_runs) >= ALERT_THRESHOLD);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" aria-hidden />
          Auto-ajuste bloqueado
        </CardTitle>
        <CardDescription>
          Filas em que o auto-ajuste diário não consegue recalcular o SLA por falta de amostra
          suficiente. A partir de {ALERT_THRESHOLD} execuções consecutivas, os administradores são
          notificados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os bloqueios do auto-ajuste.
          </p>
        ) : rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
            Nenhuma fila bloqueada — todas as execuções recentes tiveram amostra suficiente.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const isAlert = Number(r.blocked_runs) >= ALERT_THRESHOLD;
              return (
                <li
                  key={r.queue_kind}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {LABELS[r.queue_kind] ?? r.queue_kind}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.blocked_runs} execução(ões) consecutivas · há {fmtDays(r.blocked_days)}
                    </p>
                  </div>
                  <Badge variant={isAlert ? "destructive" : "secondary"}>
                    {isAlert ? "Alerta" : "Observando"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {alerts.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Sugestão: reduza a janela de análise ou aumente o volume de jobs nessas filas para
            destravar a recomendação de SLA.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
