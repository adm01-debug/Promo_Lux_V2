import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Database, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  usePartitionPolicies,
  usePartitionAdvisories,
  useEvaluatePartitions,
  useAcknowledgeAdvisory,
  formatBytes,
  type PartitionPolicy,
  type PartitionAdvisory,
} from "@/hooks/usePartitionAdvisories";

function pct(current: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min(100, Math.round((current / threshold) * 100));
}

function PolicyCard({ policy, advisories }: { policy: PartitionPolicy; advisories: PartitionAdvisory[] }) {
  const latest = advisories.find((a) => a.table_name === policy.table_name);
  const rows = latest?.live_rows ?? 0;
  const bytes = latest?.total_bytes ?? 0;
  const rowsPct = pct(rows, policy.threshold_rows);
  const bytesPct = pct(bytes, policy.threshold_bytes);
  const breached = latest?.breached_rows || latest?.breached_bytes;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-mono">
            <Layers className="h-4 w-4 text-primary" />
            {policy.table_name}
          </CardTitle>
          <Badge variant={policy.enabled ? "default" : "secondary"}>
            {policy.enabled ? "Ativa" : "Inativa"}
          </Badge>
        </div>
        <CardDescription>{policy.partition_by}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Linhas {latest ? `(${rows.toLocaleString("pt-BR")})` : ""}</span>
            <span>limite {policy.threshold_rows.toLocaleString("pt-BR")}</span>
          </div>
          <Progress value={rowsPct} className={cn(rowsPct >= 100 && "[&>div]:bg-destructive")} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tamanho {latest ? `(${formatBytes(bytes)})` : ""}</span>
            <span>limite {formatBytes(policy.threshold_bytes)}</span>
          </div>
          <Progress value={bytesPct} className={cn(bytesPct >= 100 && "[&>div]:bg-destructive")} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          {breached ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Threshold atingido — particionamento recomendado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Dentro do baseline
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PartitionAdvisoryPanel() {
  const { data: policies = [], isLoading: loadingPolicies } = usePartitionPolicies();
  const { data: advisories = [], isLoading: loadingAdvisories } = usePartitionAdvisories();
  const evaluate = useEvaluatePartitions();
  const ack = useAcknowledgeAdvisory();

  const openAdvisories = advisories.filter((a) => !a.acknowledged_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Estratégia de Particionamento
          </h3>
          <p className="text-sm text-muted-foreground">
            Avaliação automática diária; recomenda particionar ao atingir o threshold de volume.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => evaluate.mutate()}
          disabled={evaluate.isPending}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", evaluate.isPending && "animate-spin")} />
          Avaliar agora
        </Button>
      </div>

      {loadingPolicies ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <PolicyCard policy={p} advisories={advisories} />
            </motion.div>
          ))}
        </div>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recomendações</CardTitle>
          <CardDescription>
            {openAdvisories.length > 0
              ? `${openAdvisories.length} recomendação(ões) pendente(s).`
              : "Nenhuma recomendação pendente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAdvisories ? (
            <div className="h-16 rounded bg-muted/40 animate-pulse" />
          ) : advisories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Tudo dentro do baseline — nenhum particionamento necessário no momento.
            </p>
          ) : (
            <ScrollArea className="max-h-80">
              <ul className="space-y-3">
                {advisories.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      a.acknowledged_at ? "border-border/50 opacity-60" : "border-destructive/40 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{a.table_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{a.recommendation}</p>
                    {!a.acknowledged_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 gap-1"
                        onClick={() => ack.mutate(a.id)}
                        disabled={ack.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reconhecer
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
