import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, RefreshCw, Search, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAutomationLogs, type AutomationLogFilters, type AutomationExecutionLog } from "@/hooks/useAutomationLogs";

const levelStyle: Record<string, string> = {
  error: "border-destructive/50 bg-destructive/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  info: "border-border/50",
};

const levelBadge: Record<string, string> = {
  error: "bg-destructive/15 text-destructive",
  warn: "bg-amber-500/15 text-amber-500",
  info: "bg-sky-500/15 text-sky-500",
};

const levelIcon: Record<string, typeof Info> = {
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

const phaseLabel: Record<string, string> = {
  claim: "Reserva",
  execute: "Execução",
  complete: "Conclusão",
  fail: "Falha",
  retry: "Retentativa",
  dead_letter: "Dead-letter",
  cancel: "Cancelamento",
};

function LogRow({ log }: { log: AutomationExecutionLog }) {
  const Icon = levelIcon[log.level] ?? Info;
  return (
    <li className={cn("rounded-lg border p-3 text-sm", levelStyle[log.level])}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="h-4 w-4" />
          {log.message ?? log.step_name ?? "Evento"}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge variant="outline" className={cn("font-mono", levelBadge[log.level])}>
          {log.level.toUpperCase()}
        </Badge>
        <Badge variant="secondary">{phaseLabel[log.phase] ?? log.phase}</Badge>
        <Badge variant="secondary">{log.status}</Badge>
        {log.source && <Badge variant="outline">{log.source}</Badge>}
        {log.attempt != null && (
          <Badge variant="outline">tentativa {log.attempt}/{log.max_attempts ?? "?"}</Badge>
        )}
        {log.http_status != null && <Badge variant="outline">HTTP {log.http_status}</Badge>}
        {log.transient != null && (
          <Badge variant="outline">{log.transient ? "transitório" : "permanente"}</Badge>
        )}
        {log.duration_ms != null && <Badge variant="outline">{log.duration_ms} ms</Badge>}
      </div>
      {log.failure_reason && (
        <p className="mt-2 font-mono text-xs text-destructive">causa: {log.failure_reason}</p>
      )}
      {log.error_detail && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-3 break-all">{log.error_detail}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
        {log.scrape_job_id && <span>job: {log.scrape_job_id.slice(0, 8)}</span>}
        {log.queue_task_id && <span>task: {log.queue_task_id.slice(0, 8)}</span>}
        {log.correlation_id && <span>corr: {log.correlation_id.slice(0, 8)}</span>}
        {log.worker_id && <span>worker: {log.worker_id}</span>}
        <span>tenant: {log.organization_id.slice(0, 8)}</span>
      </div>
    </li>
  );
}

export function AutomationLogsPanel() {
  const [filters, setFilters] = useState<AutomationLogFilters>({ level: "all", phase: "all", search: "" });
  const [searchInput, setSearchInput] = useState("");
  const { data: logs = [], isLoading, isFetching, refetch } = useAutomationLogs(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Auditoria de Execuções de Automação
          </h3>
          <p className="text-sm text-muted-foreground">
            Rastreabilidade por job, tenant, etapa e causa de falha — para diagnóstico rápido.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative flex-1 min-w-[200px]"
              onSubmit={(e) => { e.preventDefault(); setFilters((f) => ({ ...f, search: searchInput })); }}
            >
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por mensagem, causa ou etapa…"
                className="pl-8"
              />
            </form>
            <Select value={filters.level} onValueChange={(v) => setFilters((f) => ({ ...f, level: v as AutomationLogFilters["level"] }))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos níveis</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.phase} onValueChange={(v) => setFilters((f) => ({ ...f, phase: v }))}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas fases</SelectItem>
                {Object.entries(phaseLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CardDescription className="pt-1">
            {isLoading ? "Carregando…" : `${logs.length} evento(s) recente(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum log de execução encontrado com os filtros atuais.
            </p>
          ) : (
            <ScrollArea className="max-h-[32rem]">
              <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pr-2">
                {logs.map((log) => <LogRow key={log.id} log={log} />)}
              </motion.ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
