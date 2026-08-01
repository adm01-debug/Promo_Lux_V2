import { useState } from "react";
import { motion } from "framer-motion";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import {
  useEmailAccountAuditLog,
  type EmailAccountAuditEntry,
  type EmailAccountAuditAction,
} from "@/hooks/useEmailAccountAuditLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  History,
  Plug,
  Unplug,
  ArrowLeftRight,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Power,
  PowerOff,
  Pencil,
  Building2,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ACTION_META: Record<
  EmailAccountAuditAction,
  { label: string; icon: typeof Plug; tone: string }
> = {
  connected:        { label: "Conectada",            icon: Plug,           tone: "text-success border-success/30" },
  disconnected:     { label: "Desconectada",         icon: Unplug,         tone: "text-destructive border-destructive/30" },
  scope_changed:    { label: "Escopo alterado",      icon: ArrowLeftRight, tone: "text-primary border-primary/30" },
  tokens_refreshed: { label: "Tokens atualizados",   icon: KeyRound,       tone: "text-foreground border-border" },
  reactivated:      { label: "Reativada",            icon: Power,          tone: "text-success border-success/30" },
  deactivated:      { label: "Desativada",           icon: PowerOff,       tone: "text-warning border-warning/30" },
  error_recorded:   { label: "Erro registrado",      icon: AlertCircle,    tone: "text-destructive border-destructive/30" },
  polled:           { label: "Sincronização",        icon: RefreshCw,      tone: "text-muted-foreground border-border" },
  updated:          { label: "Atualizada",           icon: Pencil,         tone: "text-foreground border-border" },
};

function ScopeBadge({ scope }: { scope: "user" | "organization" | null }) {
  if (!scope) return null;
  return scope === "organization" ? (
    <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
      <Building2 className="h-2.5 w-2.5" /> Compartilhada
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] gap-1">
      <UserIcon className="h-2.5 w-2.5" /> Pessoal
    </Badge>
  );
}

function actorInitials(name?: string | null, id?: string | null) {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return id ? id.slice(0, 2).toUpperCase() : "?";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function summary(entry: EmailAccountAuditEntry): string {
  switch (entry.action) {
    case "scope_changed":
      return `${entry.previous_scope_type === "user" ? "Pessoal" : "Compartilhada"} → ${
        entry.scope_type === "organization" ? "Compartilhada" : "Pessoal"
      }`;
    case "error_recorded": {
      const err = (entry.new_data?.last_error as string | undefined) ?? null;
      return err ? err.slice(0, 100) : "Erro de sincronização registrado";
    }
    case "tokens_refreshed":
      return "Access/refresh token rotacionado pelo provedor";
    case "polled":
      return "Cursor de sincronização atualizado";
    case "reactivated":
      return "Conta marcada como ativa novamente";
    case "deactivated":
      return "Conta marcada como inativa";
    case "connected":
      return "Integração OAuth concluída";
    case "disconnected":
      return "Integração removida (tokens podem ter sido revogados)";
    default:
      return "Campos atualizados";
  }
}

export function EmailAccountsAuditPanel() {
  const { activeOrgId } = useActiveOrganization();
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const { data, isLoading, isFetching } = useEmailAccountAuditLog(activeOrgId, page, pageSize);
  const entries = data?.entries ?? [];

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Histórico de auditoria</h3>
        <Badge variant="outline" className="text-[10px]">
          {entries.length} {entries.length === 1 ? "evento" : "eventos"}
        </Badge>
        <p className="text-[11px] text-muted-foreground ml-auto">
          Conexões, atualizações e desconexões de contas OAuth desta organização.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhum evento registrado ainda. Conecte ou desconecte uma caixa para ver o histórico aqui.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e, idx) => {
            const meta = ACTION_META[e.action];
            const Icon = meta.icon;
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.2) }}
                className="rounded-md border border-border/40 bg-secondary/10 px-3 py-2 flex items-start gap-3"
              >
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${meta.tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] gap-1 ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                    {e.email && (
                      <span className="text-xs font-medium truncate">{e.email}</span>
                    )}
                    {e.provider && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {e.provider}
                      </Badge>
                    )}
                    <ScopeBadge scope={e.scope_type} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {summary(e)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={e.actor_profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {actorInitials(e.actor_profile?.full_name, e.actor_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right">
                    <p className="text-[11px] font-medium leading-tight truncate max-w-[120px]">
                      {e.actor_profile?.full_name ??
                        (e.actor_id ? `${e.actor_id.slice(0, 8)}…` : "Sistema")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatWhen(e.created_at)}</p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {(page > 0 || data?.hasMore) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3 w-3" /> Anterior
          </Button>
          <span className="text-[11px] text-muted-foreground">Página {page + 1}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            disabled={!data?.hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}