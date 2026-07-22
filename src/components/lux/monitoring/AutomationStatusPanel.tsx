import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  RefreshCw,
  XCircle,
  Waypoints,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const REFETCH_MS = 15_000;
const WINDOW_HOURS = 24;

type QueueSnapshot = {
  label: string;
  table: "scrape_queue" | "web_scrape_queue";
  dlqTable: "scrape_dead_letter" | "web_scrape_dead_letter";
  pending: number;
  running: number;
  failed: number;
  dlq: number;
  total: number;
};

type ExecutionLog = {
  id: string;
  created_at: string;
  source: string;
  step_name: string | null;
  status: string;
  level: string;
  message: string | null;
  failure_reason: string | null;
  duration_ms: number | null;
  attempt: number | null;
  max_attempts: number | null;
  correlation_id: string | null;
};

type FailureByStep = {
  step: string;
  source: string;
  count: number;
  lastAt: string;
  lastReason: string | null;
};

async function countBy(
  table: "scrape_queue" | "web_scrape_queue",
  status?: string,
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (status) q = q.eq("status", status);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function countTable(table: "scrape_dead_letter" | "web_scrape_dead_letter"): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function fetchQueueSnapshots(): Promise<QueueSnapshot[]> {
  const specs: Array<Omit<QueueSnapshot, "pending" | "running" | "failed" | "dlq" | "total">> = [
    { label: "Scrape (GMaps / Empresas)", table: "scrape_queue", dlqTable: "scrape_dead_letter" },
    { label: "Web Scrape (Nativo)", table: "web_scrape_queue", dlqTable: "web_scrape_dead_letter" },
  ];

  return Promise.all(
    specs.map(async (spec) => {
      const [pending, running, failed, dlq, total] = await Promise.all([
        countBy(spec.table, "pending"),
        countBy(spec.table, "running"),
        countBy(spec.table, "failed"),
        countTable(spec.dlqTable),
        countBy(spec.table),
      ]);
      return { ...spec, pending, running, failed, dlq, total };
    }),
  );
}

async function fetchRecentExecutions(): Promise<ExecutionLog[]> {
  const { data, error } = await supabase
    .from("automation_execution_logs")
    .select(
      "id, created_at, source, step_name, status, level, message, failure_reason, duration_ms, attempt, max_attempts, correlation_id",
    )
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []) as ExecutionLog[];
}

async function fetchFailuresByStep(): Promise<FailureByStep[]> {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("automation_execution_logs")
    .select("step_name, source, failure_reason, created_at")
    .eq("level", "error")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const map = new Map<string, FailureByStep>();
  for (const row of data ?? []) {
    const step = row.step_name ?? "(sem etapa)";
    const source = row.source ?? "system";
    const key = `${source}::${step}`;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(key, {
        step,
        source,
        count: 1,
        lastAt: row.created_at,
        lastReason: row.failure_reason ?? null,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 12);
}

const statusVariant = (status: string, level: string) => {
  if (level === "error" || status === "failed") return "destructive";
  if (status === "completed" || status === "succeeded") return "default";
  if (status === "started" || status === "running") return "secondary";
  return "outline";
};

const statusIcon = (status: string, level: string) => {
  if (level === "error" || status === "failed") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "completed" || status === "succeeded") return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

export const AutomationStatusPanel = memo(() => {
  const queues = useQuery({
    queryKey: ["automation-status", "queues"],
    queryFn: fetchQueueSnapshots,
    refetchInterval: REFETCH_MS,
  });

  const executions = useQuery({
    queryKey: ["automation-status", "executions"],
    queryFn: fetchRecentExecutions,
    refetchInterval: REFETCH_MS,
  });

  const failures = useQuery({
    queryKey: ["automation-status", "failures"],
    queryFn: fetchFailuresByStep,
    refetchInterval: REFETCH_MS,
  });

  const totals = useMemo(() => {
    const list = queues.data ?? [];
    return list.reduce(
      (acc, q) => ({
        pending: acc.pending + q.pending,
        running: acc.running + q.running,
        failed: acc.failed + q.failed,
        dlq: acc.dlq + q.dlq,
      }),
      { pending: 0, running: 0, failed: 0, dlq: 0 },
    );
  }, [queues.data]);

  const failuresTotal = useMemo(
    () => (failures.data ?? []).reduce((sum, f) => sum + f.count, 0),
    [failures.data],
  );

  const refetchAll = () => {
    void queues.refetch();
    void executions.refetch();
    void failures.refetch();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Waypoints className="h-5 w-5 text-primary" />
            Status das Automações do Lux IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Filas, últimas execuções e falhas por etapa (últimas {WINDOW_HOURS}h).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} aria-label="Atualizar painel">
          <RefreshCw className={cn("h-4 w-4 mr-2", (queues.isFetching || executions.isFetching || failures.isFetching) && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Pendentes" value={totals.pending} icon={Clock} tone="muted" />
        <SummaryCard label="Em execução" value={totals.running} icon={Activity} tone="primary" />
        <SummaryCard label="Falhas ativas" value={totals.failed} icon={AlertTriangle} tone="warning" />
        <SummaryCard label="Dead Letter Queue" value={totals.dlq} icon={XCircle} tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Filas de trabalho</CardTitle>
            </div>
            <CardDescription>Profundidade atual por status e DLQ.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {queues.isLoading && <SkeletonRows count={2} />}
            {queues.isError && <ErrorRow message="Falha ao carregar filas." />}
            {(queues.data ?? []).map((q) => (
              <div key={q.table} className="rounded-lg border border-border/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{q.label}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{q.table}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <QueueStat label="Pendentes" value={q.pending} />
                  <QueueStat label="Executando" value={q.running} tone="primary" />
                  <QueueStat label="Falhas" value={q.failed} tone="warning" />
                  <QueueStat label="DLQ" value={q.dlq} tone="destructive" />
                </div>
                <p className="text-[10px] text-muted-foreground">Total registrado: {q.total.toLocaleString("pt-BR")}</p>
              </div>
            ))}
            {queues.data && queues.data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma fila registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-base">Falhas por etapa</CardTitle>
            </div>
            <CardDescription>
              {failuresTotal} falha(s) nas últimas {WINDOW_HOURS}h, agrupadas por etapa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {failures.isLoading && <SkeletonRows count={5} />}
            {failures.isError && <ErrorRow message="Falha ao carregar contagem de falhas." />}
            {failures.data && failures.data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma falha registrada no período. 🎉
              </p>
            )}
            <ScrollArea className="max-h-[320px] pr-2">
              <div className="space-y-2">
                {(failures.data ?? []).map((f) => (
                  <div
                    key={`${f.source}-${f.step}`}
                    className="flex items-start gap-3 p-2 rounded-lg border border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{f.step}</span>
                        <Badge variant="outline" className="text-[9px] font-mono">{f.source}</Badge>
                      </div>
                      {f.lastReason && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={f.lastReason}>
                          {f.lastReason}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Última: {formatDistanceToNow(new Date(f.lastAt), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">{f.count}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="glass shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Últimas execuções</CardTitle>
          </div>
          <CardDescription>25 eventos mais recentes do motor de automação.</CardDescription>
        </CardHeader>
        <CardContent>
          {executions.isLoading && <SkeletonRows count={6} />}
          {executions.isError && <ErrorRow message="Falha ao carregar execuções." />}
          {executions.data && executions.data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução registrada.</p>
          )}
          <ScrollArea className="max-h-[420px] pr-2">
            <div className="space-y-2">
              {(executions.data ?? []).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2 rounded-lg border border-border/40 hover:bg-secondary/20 transition-colors"
                >
                  <Badge
                    variant={statusVariant(log.status, log.level)}
                    className="gap-1 text-[10px] whitespace-nowrap"
                  >
                    {statusIcon(log.status, log.level)}
                    {log.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {log.step_name ?? "(sem etapa)"}
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono">{log.source}</Badge>
                      {log.attempt !== null && log.max_attempts !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          tentativa {log.attempt}/{log.max_attempts}
                        </span>
                      )}
                    </div>
                    {(log.message || log.failure_reason) && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={log.failure_reason ?? log.message ?? ""}>
                        {log.failure_reason ?? log.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}</span>
                      {log.duration_ms !== null && (
                        <>
                          <span>•</span>
                          <span>{log.duration_ms}ms</span>
                        </>
                      )}
                      {log.correlation_id && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{log.correlation_id.substring(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
});

AutomationStatusPanel.displayName = "AutomationStatusPanel";

type Tone = "muted" | "primary" | "warning" | "destructive";

const toneClasses: Record<Tone, string> = {
  muted: "text-muted-foreground",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <Card className="glass shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={cn("h-4 w-4", toneClasses[tone])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}

function QueueStat({ label, value, tone = "muted" }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className="rounded-md bg-secondary/30 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", toneClasses[tone])}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-secondary/30 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive p-2">
      <XCircle className="h-4 w-4" />
      {message}
    </div>
  );
}
