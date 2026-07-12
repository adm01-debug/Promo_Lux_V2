import { useMemo } from "react";
import { useScrapeQueue, useDeadLetterQueue, useReplayDeadLetter } from "@/hooks/useScrapeQueue";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ListChecks,
  Loader2,
  Clock,
  CheckCircle2,
  Skull,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import type { ScrapeQueueItem } from "@/hooks/useScrapeQueue";

const statusMeta: Record<ScrapeQueueItem["status"], { label: string; className: string; icon: React.ReactNode }> = {
  queued: { label: "Na fila", className: "bg-primary/15 text-primary border-primary/30", icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Processando", className: "bg-warning/15 text-warning border-warning/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  succeeded: { label: "Concluída", className: "bg-success/15 text-success border-success/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  dead: { label: "Dead-letter", className: "bg-destructive/15 text-destructive border-destructive/30", icon: <Skull className="h-3 w-3" /> },
};

export function ScrapeQueuePanel() {
  const { data: queue, isLoading } = useScrapeQueue();
  const { data: dlq } = useDeadLetterQueue();
  const replay = useReplayDeadLetter();

  const counts = useMemo(() => {
    const c = { queued: 0, processing: 0, succeeded: 0, dead: 0 };
    (queue ?? []).forEach((q) => { c[q.status]++; });
    return c;
  }, [queue]);

  const pendingDlq = (dlq ?? []).filter((d) => !d.replayed_at);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          Fila de Scraping
        </h2>
        <p className="text-sm text-muted-foreground">
          Retentativas com backoff exponencial · falhas definitivas vão para a dead-letter queue
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi title="Na fila" value={counts.queued} icon={<Clock className="h-4 w-4 text-primary" />} />
        <Kpi title="Processando" value={counts.processing} icon={<Loader2 className="h-4 w-4 text-warning" />} />
        <Kpi title="Concluídas" value={counts.succeeded} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
        <Kpi title="Dead-letter" value={pendingDlq.length} icon={<Skull className="h-4 w-4 text-destructive" />} />
      </div>

      {/* Fila ativa */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Tarefas na Fila</CardTitle>
          <CardDescription>Próxima execução, tentativas e último erro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>}
          {!isLoading && (queue ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa na fila.</p>
          )}
          {(queue ?? []).slice(0, 50).map((q) => {
            const meta = statusMeta[q.status];
            return (
              <div key={q.id} className="flex items-start gap-3 rounded-lg border border-border/40 p-3 bg-secondary/10">
                <Badge variant="outline" className={cn("gap-1 shrink-0", meta.className)}>
                  {meta.icon}{meta.label}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {(q.payload?.name as string) || q.source}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {q.attempts}/{q.max_attempts} tentativas
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3">
                    <span>Próxima: {format(new Date(q.next_run_at), "dd MMM HH:mm:ss", { locale: ptBR })}</span>
                    {q.locked_by && <span className="font-mono opacity-60">{q.locked_by}</span>}
                  </div>
                  {q.last_error && (
                    <p className="text-[11px] text-destructive/80 font-mono truncate mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />{q.last_error}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dead-letter queue */}
      <Card className="glass border-destructive/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Skull className="h-4 w-4 text-destructive" />
                Dead-Letter Queue
              </CardTitle>
              <CardDescription>Falhas definitivas após esgotar as tentativas. Reprocesse quando resolver a causa.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 shrink-0"
              disabled={pendingDlq.length === 0 || replayBatch.isPending}
              onClick={() => replayBatch.mutate(undefined)}
            >
              <RotateCcw className={cn("h-3.5 w-3.5", replayBatch.isPending && "animate-spin")} />
              Reprocessar todas ({pendingDlq.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {(dlq ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma falha definitiva. 🎉</p>
          )}
          {(dlq ?? []).slice(0, 50).map((d) => (
            <div key={d.id} className="flex items-start gap-3 rounded-lg border border-destructive/20 p-3 bg-destructive/5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {(d.payload?.name as string) || d.source}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {d.attempts} tentativas · {format(new Date(d.failed_at), "dd MMM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {d.last_error && (
                  <p className="text-[11px] text-destructive/80 font-mono truncate mt-1">{d.last_error}</p>
                )}
                {d.replayed_at && (
                  <p className="text-[11px] text-success mt-1">Reprocessada em {format(new Date(d.replayed_at), "dd MMM HH:mm", { locale: ptBR })}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8"
                disabled={!!d.replayed_at || replay.isPending}
                onClick={() => replay.mutate(d.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reprocessar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="glass shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
