import { Terminal, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/lux/EmptyState";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/hooks/useAutomationsMonitor";

function levelIcon(level: string | null, status: string | null) {
  if (level === "error" || status === "failed") return XCircle;
  if (level === "warn") return AlertTriangle;
  if (status === "succeeded" || status === "completed") return CheckCircle2;
  return Info;
}

function levelTone(level: string | null, status: string | null) {
  if (level === "error" || status === "failed") return "text-destructive";
  if (level === "warn") return "text-yellow-500";
  if (status === "succeeded" || status === "completed") return "text-primary";
  return "text-muted-foreground";
}

/** Fluxo cronológico dos últimos eventos de execução das automações. */
export function AutomationEventsFeed({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Terminal}
        title="Sem eventos recentes"
        description="Os eventos de raspagem, enrichment e localização aparecem aqui conforme acontecem."
      />
    );
  }

  return (
    <ScrollArea className="h-[420px] rounded-lg border border-border/40">
      <ol className="divide-y divide-border/20">
        {events.map((e) => {
          const Icon = levelIcon(e.level, e.status);
          const tone = levelTone(e.level, e.status);
          const detail = e.failure_reason || e.error_detail || e.message;
          return (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">{e.source}</span>
                  {e.step_name && (
                    <span className="text-xs text-muted-foreground">· {e.step_name}</span>
                  )}
                  {e.phase && (
                    <span className="rounded bg-secondary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {e.phase}
                    </span>
                  )}
                  {(e.attempt != null && e.max_attempts != null) && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      tentativa {e.attempt}/{e.max_attempts}
                    </span>
                  )}
                </div>
                {detail && (
                  <p className={cn("mt-0.5 truncate text-xs", e.level === "error" ? "text-destructive" : "text-muted-foreground")} title={detail}>
                    {detail}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted-foreground">
                <span>{formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}</span>
                {e.duration_ms != null && <span className="tabular-nums">{e.duration_ms}ms</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
