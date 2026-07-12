import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { autoTune, type BandRecommendation } from "@/lib/resilience/autotune";
import { generateScenarios } from "@/lib/resilience/scenarios";
import { DEFAULT_POLICY } from "@/lib/resilience/simulator";

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function RetryAutoTunerCard() {
  const [running, setRunning] = useState(false);
  const [recs, setRecs] = useState<BandRecommendation[] | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setRecs(null);
    // Cede o event loop antes da busca em grade (CPU-bound).
    await new Promise((r) => setTimeout(r, 0));
    const scenarios = generateScenarios();
    const result = autoTune(scenarios, { trials: 30 });
    setRecs(result);
    setRunning(false);
  }, []);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Auto-tuning da política de retry
            </CardTitle>
            <CardDescription>
              Busca em grade a melhor política (tentativas, backoff base e teto) por faixa de SLA,
              comparando com a política padrão vigente.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={run} disabled={running}>
            <Gauge className={cn("h-4 w-4", running && "animate-pulse")} />
            {running ? "Otimizando…" : "Otimizar política"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!recs && !running && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Padrão atual: {DEFAULT_POLICY.maxAttempts} tentativas · base {DEFAULT_POLICY.baseDelaySecs}s ·
            teto {DEFAULT_POLICY.maxDelaySecs}s. Clique em "Otimizar política" para recomendações por faixa.
          </p>
        )}
        {running && (
          <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Avaliando centenas de combinações de política via Monte Carlo…
          </p>
        )}
        {recs && !running && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 md:grid-cols-3"
          >
            {recs.map((rec) => {
              const improved = rec.scoreDelta > 0.001;
              return (
                <div
                  key={rec.band.id}
                  className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{rec.band.label}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-[10px]",
                        improved ? "text-emerald-500 border-emerald-500/40" : "text-muted-foreground",
                      )}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {improved ? `+${(rec.scoreDelta * 100).toFixed(1)}pts` : "ótima"}
                    </Badge>
                  </div>

                  <div className="font-mono text-xs space-y-1 text-foreground/90">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">tentativas</span>
                      <span>{rec.best.policy.maxAttempts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">backoff base</span>
                      <span>{rec.best.policy.baseDelaySecs}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">teto</span>
                      <span>{rec.best.policy.maxDelaySecs}s</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div>
                      <p className="text-muted-foreground">sucesso</p>
                      <p className="font-mono text-emerald-500">{pct(rec.best.successRate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">DLQ</p>
                      <p className="font-mono text-destructive">{pct(rec.best.dlqRate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SLA</p>
                      <p className="font-mono text-amber-500">{pct(rec.best.slaBreachRate)}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2">
                    {rec.scenarioCount} cenários · baseline sucesso {pct(rec.baseline.successRate)}
                  </p>
                </div>
              );
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
