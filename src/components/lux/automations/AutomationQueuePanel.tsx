import { ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/lux/EmptyState";
import { cn } from "@/lib/utils";
import type { QueueRow } from "@/hooks/useAutomationsMonitor";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  processing: "secondary",
  succeeded: "default",
  dead: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  succeeded: "Concluída",
  dead: "Falha",
};

/** Fila de raspagem com tentativas, prioridade, próximo run e último erro. */
export function AutomationQueuePanel({ queue }: { queue: QueueRow[] }) {
  if (queue.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Fila vazia"
        description="Nenhuma tarefa de automação pendente no momento. Novas tarefas aparecem aqui em tempo real."
      />
    );
  }

  return (
    <ScrollArea className="h-[420px] rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Origem</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Tentativas</th>
            <th className="px-4 py-2.5 font-medium">Próx. execução</th>
            <th className="px-4 py-2.5 font-medium">Último erro</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((t) => {
            const exhausted = t.attempts >= t.max_attempts;
            return (
              <tr key={t.id} className="border-b border-border/20 transition-colors hover:bg-secondary/20">
                <td className="px-4 py-2.5 font-medium">{t.source}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("tabular-nums", exhausted && "font-semibold text-destructive")}>
                    {t.attempts}/{t.max_attempts}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(t.next_run_at), { addSuffix: true, locale: ptBR })}
                </td>
                <td className="max-w-[280px] truncate px-4 py-2.5 text-xs text-muted-foreground" title={t.last_error ?? ""}>
                  {t.last_error ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
