import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Zap,
  Timer,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useCircuitBreakers,
  useResetCircuitBreaker,
  type CircuitBreaker,
  type CircuitBreakerState,
} from "@/hooks/useCircuitBreakers";

const STATE_META: Record<
  CircuitBreakerState,
  { label: string; icon: typeof ShieldCheck; badge: string; dot: string; desc: string }
> = {
  closed: {
    label: "Fechado (saudável)",
    icon: ShieldCheck,
    badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    dot: "bg-emerald-400",
    desc: "Tráfego fluindo normalmente para o provedor.",
  },
  open: {
    label: "Aberto (bloqueado)",
    icon: ShieldAlert,
    badge: "border-red-500/40 text-red-400 bg-red-500/10",
    dot: "bg-red-400",
    desc: "Provedor degradado — chamadas suspensas, tarefas adiadas.",
  },
  "half-open": {
    label: "Meio-aberto (sondando)",
    icon: ShieldQuestion,
    badge: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    dot: "bg-amber-400",
    desc: "Testando recuperação com uma sonda antes de reabrir o fluxo.",
  },
};

/** Calcula o instante do próximo probe (quando o circuito aberto tentará half-open). */
function nextProbeInfo(cb: CircuitBreaker): { label: string; overdue: boolean } | null {
  if (cb.state !== "open" || !cb.opened_at) return null;
  const openedAt = new Date(cb.opened_at).getTime();
  const probeAt = openedAt + cb.reset_timeout_ms;
  const now = Date.now();
  if (now >= probeAt) return { label: "sonda liberada", overdue: true };
  const secs = Math.ceil((probeAt - now) / 1000);
  return { label: `em ~${secs}s`, overdue: false };
}

function BreakerCard({ cb }: { cb: CircuitBreaker }) {
  const meta = STATE_META[cb.state] ?? STATE_META.closed;
  const StateIcon = meta.icon;
  const reset = useResetCircuitBreaker();
  const probe = nextProbeInfo(cb);
  const failurePct = cb.threshold > 0 ? Math.min(100, (cb.failure_count / cb.threshold) * 100) : 0;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-mono">
            <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
            {cb.service_name}
          </CardTitle>
          <Badge variant="outline" className={cn("gap-1 font-medium", meta.badge)}>
            <StateIcon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>
        <CardDescription>{meta.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs">Falhas / limite</span>
            </div>
            <div className="mt-1 font-mono text-lg font-semibold">
              {cb.failure_count}
              <span className="text-sm text-muted-foreground"> / {cb.threshold}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  failurePct >= 100 ? "bg-red-400" : failurePct >= 60 ? "bg-amber-400" : "bg-emerald-400",
                )}
                style={{ width: `${failurePct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              <span className="text-xs">Próxima sonda</span>
            </div>
            <div className="mt-1 font-mono text-lg font-semibold">
              {probe ? (
                <span className={cn(probe.overdue ? "text-amber-400" : "text-foreground")}>
                  {probe.label}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              reset: {Math.round(cb.reset_timeout_ms / 1000)}s
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="space-y-0.5">
            {cb.opened_at && (
              <p className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                Aberto em {format(new Date(cb.opened_at), "dd/MM HH:mm:ss", { locale: ptBR })}
              </p>
            )}
            {cb.last_failure_at && (
              <p className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Última falha {format(new Date(cb.last_failure_at), "dd/MM HH:mm:ss", { locale: ptBR })}
              </p>
            )}
            {!cb.opened_at && !cb.last_failure_at && <p>Sem falhas registradas.</p>}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={reset.isPending || (cb.state === "closed" && cb.failure_count === 0)}
            onClick={() => reset.mutate(cb.service_name)}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", reset.isPending && "animate-spin")} />
            Reiniciar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CircuitBreakerPanel() {
  const { data: breakers, isLoading, refetch, isFetching } = useCircuitBreakers();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Disjuntores de serviços externos
          </h3>
          <p className="text-sm text-muted-foreground">
            Estado, contagem de falhas e próxima sonda de recuperação. Reinicie manualmente após
            resolver um incidente no provedor.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-secondary/30" />
          ))}
        </div>
      ) : !breakers || breakers.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-400" />
            <p className="font-medium">Nenhum disjuntor registrado ainda</p>
            <p className="text-sm text-muted-foreground">
              Os disjuntores aparecem automaticamente na primeira chamada a um serviço externo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[70vh]">
          <div className="grid gap-4 md:grid-cols-2">
            {breakers.map((cb) => (
              <BreakerCard key={cb.service_name} cb={cb} />
            ))}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  );
}
