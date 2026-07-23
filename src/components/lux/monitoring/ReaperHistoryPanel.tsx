import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertOctagon, RefreshCw, Skull, Timer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useReaperHistory } from "@/hooks/useReaperHistory";
import { cn } from "@/lib/utils";

/**
 * Painel: histórico do reaper de tarefas travadas (Rodada #40).
 * Mostra evolução de requeue/dead por fila e a última execução em detalhe.
 */
export function ReaperHistoryPanel() {
  const { data: runs, isLoading } = useReaperHistory(50);

  const kpis = useMemo(() => {
    if (!runs?.length) return { totalRequeued: 0, totalDead: 0, avgDuration: 0, runsCount: 0 };
    const totalRequeued = runs.reduce(
      (s, r) => s + r.instagram_requeued + r.scrape_requeued + r.web_requeued,
      0,
    );
    const totalDead = runs.reduce(
      (s, r) => s + r.instagram_dead + r.scrape_dead + r.web_dead,
      0,
    );
    const durations = runs.map((r) => r.duration_ms ?? 0).filter((d) => d > 0);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;
    return { totalRequeued, totalDead, avgDuration, runsCount: runs.length };
  }, [runs]);

  const chartData = useMemo(() => {
    if (!runs) return [];
    return [...runs]
      .reverse()
      .map((r) => ({
        time: format(new Date(r.ran_at), "HH:mm", { locale: ptBR }),
        instagram: r.instagram_requeued + r.instagram_dead,
        scrape: r.scrape_requeued + r.scrape_dead,
        web: r.web_requeued + r.web_dead,
      }));
  }, [runs]);

  const lastRun = runs?.[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reaper de Tarefas Travadas
          </CardTitle>
          <CardDescription>
            Histórico do cron que recupera automaticamente tarefas presas em <code>running/processing</code> após falha de worker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Execuções" value={String(kpis.runsCount)} icon={<RefreshCw className="h-4 w-4" />} />
            <KpiCard label="Recuperadas" value={String(kpis.totalRequeued)} icon={<AlertOctagon className="h-4 w-4 text-warning" />} />
            <KpiCard label="Enviadas p/ DLQ" value={String(kpis.totalDead)} icon={<Skull className="h-4 w-4 text-destructive" />} />
            <KpiCard label="Duração média" value={`${kpis.avgDuration}ms`} icon={<Timer className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações por execução (por fila)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="instagram" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="scrape" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="web" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Última execução</CardTitle>
            <CardDescription>
              {format(new Date(lastRun.ran_at), "PPpp", { locale: ptBR })} · timeout {lastRun.stale_after_seconds}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <QueueBox name="Instagram" requeued={lastRun.instagram_requeued} dead={lastRun.instagram_dead} />
              <QueueBox name="Scrape (legado)" requeued={lastRun.scrape_requeued} dead={lastRun.scrape_dead} />
              <QueueBox name="Web scrape" requeued={lastRun.web_requeued} dead={lastRun.web_dead} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas 50 execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Quando</th>
                  <th className="text-right">IG (req/dead)</th>
                  <th className="text-right">Scrape</th>
                  <th className="text-right">Web</th>
                  <th className="text-right">ms</th>
                </tr>
              </thead>
              <tbody>
                {runs?.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="py-2">{format(new Date(r.ran_at), "dd/MM HH:mm:ss")}</td>
                    <td className="text-right font-mono">{r.instagram_requeued}/{r.instagram_dead}</td>
                    <td className="text-right font-mono">{r.scrape_requeued}/{r.scrape_dead}</td>
                    <td className="text-right font-mono">{r.web_requeued}/{r.web_dead}</td>
                    <td className="text-right font-mono text-muted-foreground">{r.duration_ms ?? "—"}</td>
                  </tr>
                ))}
                {!runs?.length && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhuma execução registrada ainda. O cron roda a cada minuto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function QueueBox({ name, requeued, dead }: { name: string; requeued: number; dead: number }) {
  const total = requeued + dead;
  return (
    <div className={cn("rounded-md border p-3", total > 0 ? "border-warning/50 bg-warning/5" : "border-border/60")}>
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="mt-1 flex items-center gap-3">
        <Badge variant="secondary">{requeued} requeue</Badge>
        <Badge variant={dead > 0 ? "destructive" : "outline"}>{dead} DLQ</Badge>
      </div>
    </div>
  );
}
