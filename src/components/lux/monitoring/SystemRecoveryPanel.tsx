import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecoveryCron {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
}

interface RecoveryHealth {
  generated_at: string;
  crons: RecoveryCron[];
  queues: {
    scrape_backlog: number;
    web_scrape_backlog: number;
    dlq_legacy_pending: number;
    dlq_web_pending: number;
  };
  snapshots: {
    pg_net_last: string | null;
    pg_net_age_secs: number | string | null;
    db_health_last: string | null;
    db_health_age_secs: number | string | null;
  };
}

interface RecoveryResponse {
  ok?: boolean;
  health?: RecoveryHealth;
  error?: string;
}

const QUEUE_TILES: Array<{
  key: keyof RecoveryHealth["queues"];
  label: string;
  criticalWhenPositive: boolean;
}> = [
  { key: "scrape_backlog", label: "Fila de scraping (pendentes)", criticalWhenPositive: false },
  { key: "web_scrape_backlog", label: "Fila web (pendentes)", criticalWhenPositive: false },
  { key: "dlq_legacy_pending", label: "Dead-letter legada sem reprocessar", criticalWhenPositive: true },
  { key: "dlq_web_pending", label: "Dead-letter web sem reprocessar", criticalWhenPositive: true },
];

function toSeconds(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatAge(secs: number | null): string {
  if (secs === null) return "—";
  if (secs < 60) return `${Math.round(secs)} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  if (secs < 86400) return `${Math.round(secs / 3600)} h`;
  return `${Math.round(secs / 86400)} d`;
}

function AgeBadge({ secs }: { secs: number | null }) {
  if (secs === null) {
    return (
      <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground">
        <Clock className="h-3 w-3" /> sem registro
      </Badge>
    );
  }
  if (secs <= 2 * 3600) {
    return (
      <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/30">
        <CheckCircle2 className="h-3 w-3" /> atualizado
      </Badge>
    );
  }
  if (secs <= 24 * 3600) {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500/40 text-yellow-500">
        <Clock className="h-3 w-3" /> atrasado
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" /> parado
    </Badge>
  );
}

function CronStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground">
        nunca executou
      </Badge>
    );
  }
  if (status === "succeeded") {
    return (
      <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/30">
        <CheckCircle2 className="h-3 w-3" /> ok
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> falhou
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      {status}
    </Badge>
  );
}

/**
 * Consome a edge function `system-recovery-status` (admin-only), que por sua vez
 * chama a RPC `system_recovery_health`: panorama de crons ativos, filas e
 * snapshots de saúde usados no diagnóstico de recuperação de desastre.
 */
export function SystemRecoveryPanel() {
  const { data, isLoading, isFetching, refetch, error } = useQuery<RecoveryHealth>({
    queryKey: ["system-recovery-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<RecoveryResponse>(
        "system-recovery-status",
      );
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 403) throw new Error("Acesso restrito a administradores.");
        if (status === 401) throw new Error("Sessão expirada — entre novamente.");
        throw error;
      }
      const payload = data?.health;
      if (!payload) throw new Error(data?.error ?? "Resposta inesperada do servidor.");
      return payload;
    },
    refetchInterval: 120_000,
    retry: 1,
  });

  const crons = [...(data?.crons ?? [])].sort((a, b) => a.jobname.localeCompare(b.jobname));
  const failing = crons.filter((c) => c.last_status === "failed").length;
  const pgNetAge = toSeconds(data?.snapshots.pg_net_age_secs ?? null);
  const dbHealthAge = toSeconds(data?.snapshots.db_health_age_secs ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recuperação &amp; DR
          </h2>
          <p className="text-sm text-muted-foreground">
            Panorama consolidado de agendamentos, filas e snapshots de saúde — use antes e depois de uma
            restauração para saber o que voltou a rodar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.generated_at && (
            <span className="text-xs text-muted-foreground">
              Coletado em {format(new Date(data.generated_at), "dd/MM HH:mm:ss", { locale: ptBR })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar panorama de recuperação"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o panorama</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && <div className="h-48 glass rounded-xl animate-pulse" />}

      {!isLoading && !error && crons.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nenhum agendamento ativo</AlertTitle>
          <AlertDescription>
            O banco não reportou jobs ativos. Verifique se a extensão pg_cron está instalada e se os jobs
            foram recriados após a restauração.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {QUEUE_TILES.map((tile) => {
              const value = data?.queues[tile.key] ?? 0;
              const critical = tile.criticalWhenPositive && value > 0;
              return (
                <Card key={tile.key} className="glass">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">{tile.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={
                        critical
                          ? "text-2xl font-mono font-bold text-destructive"
                          : "text-2xl font-mono font-bold"
                      }
                    >
                      {value}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Snapshots de saúde
              </CardTitle>
              <CardDescription className="text-xs">
                Idade do último snapshot de rede e de banco. Acima de 24 h o diagnóstico de DR fica cego.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded bg-secondary/30 space-y-1">
                <div className="text-xs text-muted-foreground">pg_net_health_snapshots</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{formatAge(pgNetAge)}</span>
                  <AgeBadge secs={pgNetAge} />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data?.snapshots.pg_net_last
                    ? format(new Date(data.snapshots.pg_net_last), "dd/MM HH:mm", { locale: ptBR })
                    : "nenhum snapshot registrado"}
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/30 space-y-1">
                <div className="text-xs text-muted-foreground">db_health_snapshots</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{formatAge(dbHealthAge)}</span>
                  <AgeBadge secs={dbHealthAge} />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data?.snapshots.db_health_last
                    ? format(new Date(data.snapshots.db_health_last), "dd/MM HH:mm", { locale: ptBR })
                    : "nenhum snapshot registrado"}
                </div>
              </div>
            </CardContent>
          </Card>

          {crons.length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Agendamentos ativos</CardTitle>
                    <CardDescription className="text-xs">
                      {crons.length} job(s) ativo(s) no pg_cron, com o status da última execução.
                    </CardDescription>
                  </div>
                  {failing > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" /> {failing} com falha na última execução
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/30">
                      <CheckCircle2 className="h-3 w-3" /> nenhuma falha registrada
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[420px] overflow-auto rounded border border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Agenda</TableHead>
                        <TableHead>Última execução</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {crons.map((cron) => (
                        <TableRow key={cron.jobname}>
                          <TableCell className="font-mono text-xs">{cron.jobname}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {cron.schedule}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {cron.last_run
                              ? format(new Date(cron.last_run), "dd/MM HH:mm:ss", { locale: ptBR })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <CronStatusBadge status={cron.last_status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default SystemRecoveryPanel;