import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, KeyRound, Clock, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { useEmailSyncLog, type EmailSyncLogEntry } from "@/hooks/useEmailSyncLog";
import { describeEmailError } from "@/lib/emailErrorMessages";

interface AccountLite {
  id: string;
  email: string;
  provider: "gmail" | "outlook";
}

interface Props {
  account: AccountLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_META: Record<
  EmailSyncLogEntry["status"],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  success: {
    label: "Sucesso",
    icon: CheckCircle2,
    className: "text-success border-success/30",
  },
  error: {
    label: "Erro",
    icon: AlertCircle,
    className: "text-destructive border-destructive/30",
  },
  refresh_failed: {
    label: "Token falhou",
    icon: KeyRound,
    className: "text-destructive border-destructive/40",
  },
  skipped: {
    label: "Ignorado",
    icon: Clock,
    className: "text-warning border-warning/30",
  },
};

function formatDuration(ms: number | null) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Sheet com o histórico de sincronizações de uma conta.
 *
 * Mostra cada execução do polling com status, tentativas de auto-reconexão,
 * snippet de erro e duração — permite identificar visualmente quando uma
 * falha começou e o resultado de cada retry agendado.
 */
export function EmailSyncHistorySheet({ account, open, onOpenChange }: Props) {
  const [page, setPage] = useState(0);
  const accountId = account?.id ?? null;
  const { data, isLoading } = useEmailSyncLog(accountId, page, 20);

  // Reset page when switching accounts
  const handleOpenChange = (o: boolean) => {
    if (!o) setPage(0);
    onOpenChange(o);
  };

  const entries = data?.entries ?? [];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Histórico de sincronização</SheetTitle>
          <SheetDescription>
            {account ? (
              <span className="text-foreground">{account.email}</span>
            ) : (
              "Selecione uma conta"
            )}
            <span className="block text-xs text-muted-foreground mt-1">
              Cada linha é uma execução do polling. Use para identificar quando uma falha começou.
            </span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="glass rounded-lg p-6 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-foreground">Sem histórico ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                As próximas execuções do polling aparecerão aqui.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => {
                const meta = STATUS_META[e.status];
                const Icon = meta.icon;
                const duration = formatDuration(e.duration_ms);
                return (
                  <li key={e.id} className="glass rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                        <Icon className={`h-3.5 w-3.5 ${meta.className.split(" ")[0]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>
                            {meta.label}
                          </Badge>
                          {e.status === "success" && (
                            <span className="text-[11px] text-muted-foreground">
                              {e.scanned ?? 0} escaneadas · {e.inserted ?? 0} novas
                            </span>
                          )}
                          {e.status === "skipped" && e.skipped_reason && (
                            <span className="text-[11px] text-muted-foreground">
                              motivo: {e.skipped_reason}
                            </span>
                          )}
                          {(e.status === "error" || e.status === "refresh_failed") &&
                            e.attempt != null &&
                            e.max_attempts != null && (
                              <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                                tentativa {e.attempt}/{e.max_attempts}
                              </Badge>
                            )}
                          {e.fatal && (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                              fatal
                            </Badge>
                          )}
                          {e.reconnect_required && (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                              reconexão manual
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                          {duration && <span> · {duration}</span>}
                        </p>
                        {e.error_message && (
                          (() => {
                            const info = describeEmailError(e.error_message)!;
                            return (
                              <div className="mt-1 space-y-0.5">
                                <p className="text-[11px] text-destructive break-words">
                                  <span className="font-medium">{info.title}</span>
                                  {info.code && <span className="opacity-70"> · {info.code}</span>}
                                  {" — "}
                                  {info.description}
                                </p>
                                <p className="text-[11px] text-muted-foreground break-words">
                                  → {info.actionHint}
                                </p>
                                <p
                                  className="text-[10px] text-muted-foreground/70 break-words font-mono"
                                  title="Mensagem original do provedor"
                                >
                                  {info.raw}
                                </p>
                              </div>
                            );
                          })()
                        )}
                        {e.next_retry_at && (e.status === "error" || e.status === "refresh_failed") && (
                          <p className="text-[11px] text-warning mt-1">
                            Próxima tentativa: {new Date(e.next_retry_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {(page > 0 || data?.hasMore) && (
          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <span className="text-[11px] text-muted-foreground">Página {page + 1}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              disabled={!data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}