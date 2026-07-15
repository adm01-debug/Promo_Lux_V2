import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Cookie,
  Clock,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// Tipos
// ============================================================================
type Servico = "lusha" | "leadcontact" | "linkedin";
type ServicoOrVault = Servico | "vault";

interface SnapshotRow {
  id: string;
  servico: Servico;
  is_healthy: boolean | null;
  health_status: string | null;
  expires_at: string | null;
  days_until_expiry: number | null;
  vault_available: boolean;
  error_message: string | null;
  checked_at: string;
}

interface AlertRow {
  id: string;
  servico: ServicoOrVault;
  severity: "warning" | "critical";
  reason: string;
  days_until_expiry: number | null;
  triggered_at: string;
}

const SERVICOS: readonly Servico[] = ["lusha", "leadcontact", "linkedin"] as const;

const SERVICO_LABEL: Record<Servico, string> = {
  lusha: "Lusha",
  leadcontact: "LeadContact",
  linkedin: "LinkedIn",
};

const REASON_LABEL: Record<string, string> = {
  vault_unavailable: "Vault indisponível",
  unhealthy: "Não saudável",
  expired: "Expirado",
  expiring_critical: "Expira em <= 2 dias",
  expiring_warning: "Expira em <= 7 dias",
};

// ============================================================================
// Helpers de status
// ============================================================================
interface StatusMeta {
  label: string;
  icon: typeof ShieldCheck;
  badge: string;
  dot: string;
  desc: string;
}

function computeStatus(snap: SnapshotRow | undefined): StatusMeta {
  if (!snap) {
    return {
      label: "Sem dados",
      icon: ShieldQuestion,
      badge: "border-muted-foreground/40 text-muted-foreground bg-muted/10",
      dot: "bg-muted-foreground",
      desc: "Nenhuma checagem registrada ainda.",
    };
  }
  if (!snap.vault_available) {
    return {
      label: "Vault indisponível",
      icon: ShieldAlert,
      badge: "border-red-500/40 text-red-400 bg-red-500/10",
      dot: "bg-red-400",
      desc: snap.error_message ?? "Sem detalhes.",
    };
  }
  if (snap.is_healthy === false) {
    return {
      label: "Não saudável",
      icon: ShieldAlert,
      badge: "border-red-500/40 text-red-400 bg-red-500/10",
      dot: "bg-red-400",
      desc: "Cookie marcado como não saudável pelo provedor.",
    };
  }
  if (snap.days_until_expiry !== null && snap.days_until_expiry <= 0) {
    return {
      label: "Expirado",
      icon: ShieldAlert,
      badge: "border-red-500/40 text-red-400 bg-red-500/10",
      dot: "bg-red-400",
      desc: "Renovar cookie imediatamente.",
    };
  }
  if (snap.days_until_expiry !== null && snap.days_until_expiry <= 2) {
    return {
      label: "Expira em breve",
      icon: ShieldAlert,
      badge: "border-red-500/40 text-red-400 bg-red-500/10",
      dot: "bg-red-400",
      desc: "Menos de 2 dias — renovação urgente.",
    };
  }
  if (snap.days_until_expiry !== null && snap.days_until_expiry <= 7) {
    return {
      label: "Atenção",
      icon: ShieldQuestion,
      badge: "border-amber-500/40 text-amber-400 bg-amber-500/10",
      dot: "bg-amber-400",
      desc: "Menos de 7 dias para expirar.",
    };
  }
  return {
    label: "Saudável",
    icon: ShieldCheck,
    badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    dot: "bg-emerald-400",
    desc: "Cookie válido e operacional.",
  };
}

// ============================================================================
// Hooks
// ============================================================================
function useLatestSnapshots() {
  return useQuery({
    queryKey: ["vault-cookie-snapshots", "latest"],
    queryFn: async (): Promise<Record<Servico, SnapshotRow | undefined>> => {
      const { data, error } = await supabase
        .from("vault_cookie_snapshots")
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(60); // últimos 60 → pega o mais recente de cada
      if (error) throw error;
      const rows = (data ?? []) as SnapshotRow[];
      const map: Record<Servico, SnapshotRow | undefined> = {
        lusha: undefined,
        leadcontact: undefined,
        linkedin: undefined,
      };
      for (const r of rows) {
        if (SERVICOS.includes(r.servico) && !map[r.servico]) {
          map[r.servico] = r;
        }
      }
      return map;
    },
    refetchInterval: 30_000,
  });
}

function useAlertHistory() {
  return useQuery({
    queryKey: ["vault-cookie-alerts", "recent"],
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await supabase
        .from("vault_cookie_alert_history")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
    refetchInterval: 60_000,
  });
}

function useSnapshotHistory(servico: Servico) {
  return useQuery({
    queryKey: ["vault-cookie-snapshots", "history", servico],
    queryFn: async (): Promise<SnapshotRow[]> => {
      const { data, error } = await supabase
        .from("vault_cookie_snapshots")
        .select("*")
        .eq("servico", servico)
        .order("checked_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SnapshotRow[];
    },
    staleTime: 30_000,
  });
}

function useTriggerHealthCheck() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "vault-cookie-health",
        { body: { trigger: "manual-dashboard" } },
      );
      if (error) throw error;
      return data as {
        ok: boolean;
        vault_available: boolean;
        snapshots_recorded: number;
        alerts_triggered: number;
      };
    },
    onSuccess: (res) => {
      toast({
        title: "Checagem concluída",
        description: `${res.snapshots_recorded} snapshots • ${res.alerts_triggered} alertas disparados`,
      });
      qc.invalidateQueries({ queryKey: ["vault-cookie-snapshots"] });
      qc.invalidateQueries({ queryKey: ["vault-cookie-alerts"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Falha na checagem",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Sub-componentes
// ============================================================================
interface CookieCardProps {
  servico: Servico;
  snap: SnapshotRow | undefined;
}

function CookieCard({ servico, snap }: CookieCardProps) {
  const meta = computeStatus(snap);
  const StateIcon = meta.icon;
  const history = useSnapshotHistory(servico);

  const failuresLast20 = useMemo(() => {
    return (history.data ?? []).filter(
      (h) => !h.vault_available || h.is_healthy === false,
    ).length;
  }, [history.data]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-mono">
            <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
            <Cookie className="h-4 w-4 text-primary" />
            {SERVICO_LABEL[servico]}
          </CardTitle>
          <Badge variant="outline" className={cn("gap-1 font-medium", meta.badge)}>
            <StateIcon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>
        <CardDescription className="text-xs">{meta.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-muted-foreground">health_status</div>
            <div className="font-mono text-foreground">
              {snap?.health_status ?? "—"}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-muted-foreground">Expira em</div>
            <div className="font-mono text-foreground">
              {snap?.days_until_expiry === null || snap?.days_until_expiry === undefined
                ? "—"
                : `${snap.days_until_expiry} dias`}
            </div>
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground">Data de expiração</div>
            <div className="font-mono text-foreground">
              {snap?.expires_at
                ? format(new Date(snap.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : "—"}
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between border-t border-border/40 pt-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última checagem
            </span>
            <span className="font-mono text-foreground">
              {snap
                ? formatDistanceToNow(new Date(snap.checked_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "—"}
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Falhas nas últimas 20 checagens
            </span>
            <span
              className={cn(
                "font-mono font-medium",
                failuresLast20 === 0 ? "text-emerald-400" : "text-amber-400",
              )}
            >
              {history.isLoading ? "…" : `${failuresLast20}/${history.data?.length ?? 0}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertHistoryTable({ rows, isLoading }: { rows: AlertRow[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 glass rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-400" />
        <p className="text-sm">Nenhum alerta disparado nos registros recentes.</p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-[320px] pr-3">
      <div className="space-y-2">
        {rows.map((r) => {
          const isCritical = r.severity === "critical";
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3 text-sm",
                isCritical
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <div className="flex items-center gap-3">
                {isCritical ? (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="font-mono text-foreground">
                    {r.servico === "vault" ? "Vault" : SERVICO_LABEL[r.servico as Servico]}
                    <span className="text-muted-foreground mx-1">•</span>
                    <span
                      className={cn(
                        "text-xs uppercase",
                        isCritical ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {r.severity}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {REASON_LABEL[r.reason] ?? r.reason}
                    {r.days_until_expiry !== null &&
                      ` — ${r.days_until_expiry} dia(s) restantes`}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(r.triggered_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Panel principal
// ============================================================================
export function VaultCookiesPanel() {
  const snaps = useLatestSnapshots();
  const alerts = useAlertHistory();
  const trigger = useTriggerHealthCheck();

  return (
    <div className="space-y-4">
      {/* Cabeçalho + ação */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            Cookies do Vault
          </h2>
          <p className="text-sm text-muted-foreground">
            Saúde, expiração e histórico de falhas dos cookies externos (Lusha, LeadContact, LinkedIn).
          </p>
        </div>
        <Button
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", trigger.isPending && "animate-spin")} />
          {trigger.isPending ? "Verificando…" : "Executar checagem agora"}
        </Button>
      </div>

      {/* Cards de status */}
      {snaps.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 glass rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICOS.map((s) => (
            <CookieCard key={s} servico={s} snap={snaps.data?.[s]} />
          ))}
        </div>
      )}

      {/* Histórico de alertas */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Histórico de alertas
          </CardTitle>
          <CardDescription>
            Últimos 50 alertas disparados. Cooldown de 24h por serviço/severidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertHistoryTable rows={alerts.data ?? []} isLoading={alerts.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
