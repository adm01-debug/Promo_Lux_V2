import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlayCircle, Download, ShieldAlert, ShieldCheck, AlertTriangle, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResilienceSimulator } from "@/hooks/useResilienceSimulator";
import { RetryAutoTunerCard } from "./RetryAutoTunerCard";
import type { GapSeverity } from "@/lib/resilience/report";

const severityStyle: Record<GapSeverity, string> = {
  critical: "border-destructive/50 bg-destructive/10 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-500",
};

const severityIcon: Record<GapSeverity, typeof AlertTriangle> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold font-mono", tone)}>{value}</p>
    </div>
  );
}

export function ResilienceSimulatorPanel() {
  const { running, progress, report, run } = useResilienceSimulator();
  const [breakerOn, setBreakerOn] = useState(true);

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gap-report-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Simulador de Cenários de Falha
          </h3>
          <p className="text-sm text-muted-foreground">
            Executa centenas de cenários (timeout, rate limit, 4xx/5xx, indisponibilidade)
            contra a política de retry/DLQ e gera relatório de gaps antes da produção.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5">
            <Zap className={cn("h-4 w-4", breakerOn ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="breaker-switch" className="text-xs cursor-pointer whitespace-nowrap">
              Circuit breaker
            </Label>
            <Switch
              id="breaker-switch"
              checked={breakerOn}
              onCheckedChange={setBreakerOn}
              disabled={running}
            />
          </div>
          {report && (
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadReport}>
              <Download className="h-4 w-4" /> Exportar JSON
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => run({ breaker: breakerOn ? undefined : null })} disabled={running}>
            <PlayCircle className={cn("h-4 w-4", running && "animate-pulse")} />
            {running ? "Simulando…" : "Executar simulação"}
          </Button>
        </div>
      </div>


      <RetryAutoTunerCard />




      {running && (
        <Card className="glass-card">
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processando cenários…</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {report && !running && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Kpi label="Cenários" value={report.totalScenarios.toLocaleString("pt-BR")} />
            <Kpi
              label="Sem gaps"
              value={`${report.passing}/${report.totalScenarios}`}
              tone="text-emerald-500"
            />
            <Kpi
              label="Críticos"
              value={String(report.summary.critical)}
              tone={report.summary.critical > 0 ? "text-destructive" : "text-emerald-500"}
            />
            <Kpi
              label="Sucesso médio"
              value={`${(report.summary.avgSuccessRate * 100).toFixed(1)}%`}
            />
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {report.gaps.length === 0 ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                )}
                Gaps encontrados
              </CardTitle>
              <CardDescription>
                {report.gaps.length === 0
                  ? "Nenhum gap acima dos limites definidos — pronto para produção."
                  : `${report.gaps.length} gap(s): ${report.summary.critical} crítico(s), ${report.summary.warning} atenção, ${report.summary.info} informativo(s).`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.gaps.length > 0 && (
                <ScrollArea className="max-h-96">
                  <ul className="space-y-2 pr-2">
                    {report.gaps.map((g, i) => {
                      const Icon = severityIcon[g.severity];
                      return (
                        <li
                          key={`${g.scenarioId}-${g.category}-${i}`}
                          className={cn("rounded-lg border p-3 text-sm", severityStyle[g.severity])}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Icon className="h-4 w-4" /> {g.category}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {g.scenarioId}
                            </Badge>
                          </div>
                          <p className="mt-1 text-foreground/80">{g.detail}</p>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!report && !running && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Clique em "Executar simulação" para rodar os cenários de falha e gerar o relatório de gaps.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
