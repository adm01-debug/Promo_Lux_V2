import { useState } from "react";
import {
  useEnqueueWebScrape,
  useWebScrapeTasks,
  useWebScrapeStatus,
  useReplayWebDlq,
  useWebDlqHealth,
  useWebScrapeState,
  type WebScrapeTask,
} from "@/hooks/useWebScrape";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Globe, RotateCw, PlayCircle, Copy, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_VARIANT: Record<WebScrapeTask["status"], "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  processing: "default",
  succeeded: "default",
  failed: "destructive",
  dead: "destructive",
};

const STATUS_ICON: Record<WebScrapeTask["status"], React.ReactNode> = {
  queued: <Clock className="h-3 w-3" />,
  processing: <PlayCircle className="h-3 w-3 animate-pulse" />,
  succeeded: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  dead: <AlertTriangle className="h-3 w-3" />,
};

export function WebScrapeView() {
  const [url, setUrl] = useState("");
  const [waitFor, setWaitFor] = useState(0);
  const [maxBytes, setMaxBytes] = useState(2 * 1024 * 1024);
  const { selectedTaskId, select } = useWebScrapeState();

  const enqueue = useEnqueueWebScrape();
  const replay = useReplayWebDlq();
  const { data: tasks = [], isLoading } = useWebScrapeTasks(100);
  const { data: statusData } = useWebScrapeStatus(selectedTaskId);
  const { data: health } = useWebDlqHealth();

  const handleEnqueue = () => {
    if (!url.trim()) return;
    enqueue.mutate(
      { url: url.trim(), wait_for_ms: waitFor, max_bytes: maxBytes, formats: ["markdown", "links"] },
      {
        onSuccess: (data) => {
          setUrl("");
          select(data.task_id);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Motor de Scrape Web
          </CardTitle>
          <CardDescription>
            Coleta HTML → Markdown com robots.txt, circuit breaker por domínio, retry exponencial e DLQ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto]">
            <div>
              <Label htmlFor="ws-url" className="text-xs">URL</Label>
              <Input
                id="ws-url"
                placeholder="https://exemplo.com/página"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEnqueue()}
              />
            </div>
            <div>
              <Label htmlFor="ws-wait" className="text-xs">Wait (ms)</Label>
              <Input
                id="ws-wait"
                type="number"
                min={0}
                max={15000}
                value={waitFor}
                onChange={(e) => setWaitFor(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="ws-max" className="text-xs">Max bytes</Label>
              <Input
                id="ws-max"
                type="number"
                min={1024}
                max={10 * 1024 * 1024}
                value={maxBytes}
                onChange={(e) => setMaxBytes(Number(e.target.value) || 2 * 1024 * 1024)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleEnqueue} disabled={!url.trim() || enqueue.isPending} className="w-full">
                <PlayCircle className="h-4 w-4 mr-2" />
                Enfileirar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tarefas recentes</CardTitle>
              <CardDescription>
                {isLoading ? "Carregando…" : `${tasks.length} tarefa(s)`}
                {health && ` · DLQ pendente: ${(health as { pending_items: number }).pending_items ?? 0}`}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => replay.mutate(100)}
              disabled={replay.isPending}
            >
              <RotateCw className={`h-4 w-4 mr-2 ${replay.isPending ? "animate-spin" : ""}`} />
              Reprocessar DLQ
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px]">
              <div className="space-y-2">
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => select(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedTaskId === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono truncate">{t.url}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                          {t.last_error && ` · ${t.last_error.slice(0, 60)}`}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[t.status]} className="gap-1 shrink-0">
                        {STATUS_ICON[t.status]}
                        {t.status}
                      </Badge>
                    </div>
                  </button>
                ))}
                {tasks.length === 0 && !isLoading && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma tarefa ainda. Enfileire uma URL acima.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Detalhes</CardTitle>
                <CardDescription>
                  {selectedTaskId ? `Task ${selectedTaskId.slice(0, 8)}` : "Selecione uma tarefa"}
                </CardDescription>
              </div>
              {statusData?.task?.trace_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(statusData.task.trace_id)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  trace_id
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!statusData && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Clique em uma tarefa para ver o resultado.
              </div>
            )}
            {statusData && (
              <ScrollArea className="h-[420px]">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <Badge variant={STATUS_VARIANT[statusData.task.status]}>{statusData.task.status}</Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Tentativas</div>
                      <div className="font-mono">{statusData.task.attempts}/{statusData.task.max_attempts}</div>
                    </div>
                    {statusData.result?.http_status && (
                      <div>
                        <div className="text-muted-foreground">HTTP</div>
                        <div className="font-mono">{statusData.result.http_status}</div>
                      </div>
                    )}
                    {statusData.result?.duration_ms && (
                      <div>
                        <div className="text-muted-foreground">Duração</div>
                        <div className="font-mono">{statusData.result.duration_ms}ms</div>
                      </div>
                    )}
                    {statusData.result?.bytes && (
                      <div>
                        <div className="text-muted-foreground">Bytes</div>
                        <div className="font-mono">{statusData.result.bytes.toLocaleString("pt-BR")}</div>
                      </div>
                    )}
                    {statusData.result?.title && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Título</div>
                        <div className="text-sm">{statusData.result.title}</div>
                      </div>
                    )}
                  </div>

                  {statusData.task.last_error && (
                    <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      {statusData.task.last_error}
                    </div>
                  )}

                  {statusData.result?.markdown && (
                    <div>
                      <Label className="text-xs">Markdown extraído</Label>
                      <Textarea
                        readOnly
                        value={statusData.result.markdown.slice(0, 5000)}
                        className="h-48 font-mono text-[11px]"
                      />
                    </div>
                  )}

                  {statusData.result?.links && statusData.result.links.length > 0 && (
                    <div>
                      <Label className="text-xs">Links ({statusData.result.links.length})</Label>
                      <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {statusData.result.links.slice(0, 20).map((l, i) => (
                          <div key={i} className="text-[10px] truncate">
                            <span className="font-mono text-muted-foreground">→</span> {l.text || l.href}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
