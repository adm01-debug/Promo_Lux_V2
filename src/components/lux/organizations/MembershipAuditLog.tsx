import { memo, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollText, UserPlus, UserMinus, UserCog, LogOut, Filter, RefreshCw, Loader2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMembershipAuditLogPaged, type MembershipAuditEntry, type MembershipAuditAction, type AppRole } from "@/hooks/useMembershipAuditLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MembershipAuditDetailSheet } from "@/components/lux/organizations/MembershipAuditDetailSheet";

const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", sdr: "SDR", viewer: "Viewer" };

const ACTION_META: Record<MembershipAuditAction, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = {
  added:        { label: "Adicionado",   icon: UserPlus, tone: "text-success bg-success/10 ring-success/20" },
  removed:      { label: "Removido",     icon: UserMinus, tone: "text-destructive bg-destructive/10 ring-destructive/20" },
  left:         { label: "Saiu",         icon: LogOut, tone: "text-warning bg-warning/10 ring-warning/20" },
  role_changed: { label: "Papel alterado", icon: UserCog, tone: "text-info bg-info/10 ring-info/20" },
  other:        { label: "Atualização",  icon: ScrollText, tone: "text-muted-foreground bg-muted/30 ring-border/40" },
};

const labelFor = (
  profile: { full_name: string | null } | null | undefined,
  userId: string | null,
  currentUserId?: string | null,
) => {
  if (userId && currentUserId && userId === currentUserId) return "Você";
  const name = profile?.full_name?.trim();
  if (name) return name;
  if (userId) return `${userId.slice(0, 8)}…`;
  return "Sistema";
};

const describe = (e: MembershipAuditEntry, currentUserId?: string | null): string => {
  const target = labelFor(e.target_profile, e.target_user_id, currentUserId);
  switch (e.action) {
    case "added":
      return `${target} entrou como ${ROLE_LABEL[(e.new_role ?? "viewer") as AppRole]}`;
    case "removed":
      return `${target} foi removido${e.old_role ? ` (era ${ROLE_LABEL[e.old_role]})` : ""}`;
    case "left":
      return `${target} deixou o workspace${e.old_role ? ` (era ${ROLE_LABEL[e.old_role]})` : ""}`;
    case "role_changed":
      return `${target}: ${ROLE_LABEL[(e.old_role ?? "viewer") as AppRole]} → ${ROLE_LABEL[(e.new_role ?? "viewer") as AppRole]}`;
    default:
      return `${target}: alteração registrada`;
  }
};

interface Props {
  orgId: string | null;
  currentUserId?: string | null;
}

export const MembershipAuditLog = memo(({ orgId, currentUserId }: Props) => {
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | MembershipAuditAction>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MembershipAuditEntry | null>(null);
  const { data: pageData, isLoading, error, refetch, isFetching, isPlaceholderData } =
    useMembershipAuditLogPaged(orgId, page, PAGE_SIZE);
  const data = pageData?.entries;
  const hasMore = pageData?.hasMore ?? false;

  // Reset to page 0 when org changes
  useEffect(() => { setPage(0); }, [orgId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let out = filter === "all" ? data : data.filter(e => e.action === filter);
    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      out = out.filter(e => {
        const haystack = [
          e.actor_profile?.full_name ?? "",
          e.target_profile?.full_name ?? "",
          e.actor_id ?? "",
          e.target_user_id ?? "",
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return out;
  }, [data, filter, search]);

  const counts = useMemo(() => {
    const base = { all: data?.length ?? 0, added: 0, removed: 0, left: 0, role_changed: 0, other: 0 };
    (data ?? []).forEach(e => { (base as Record<string, number>)[e.action] += 1; });
    return base;
  }, [data]);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + (data?.length ?? 0);

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ScrollText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Audit log de membros</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              Histórico persistente de entradas, saídas, remoções e mudanças de papel.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome ou ID…"
              className="h-8 w-[200px] pl-7 pr-7 text-xs"
              aria-label="Buscar no audit log por nome ou ID do usuário"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({counts.all})</SelectItem>
              <SelectItem value="role_changed">Papel alterado ({counts.role_changed})</SelectItem>
              <SelectItem value="added">Adicionados ({counts.added})</SelectItem>
              <SelectItem value="removed">Removidos ({counts.removed})</SelectItem>
              <SelectItem value="left">Saídas ({counts.left})</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Atualizar"
          >
            {isFetching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-xs text-destructive">
            Não foi possível carregar o histórico. {(error as Error).message}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Apenas administradores da organização têm acesso a este registro.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Sem eventos registrados"
          description={
            search.trim().length > 0
              ? `Nenhum evento desta página corresponde a "${search.trim()}". Tente outras páginas ou limpe a busca.`
              : filter === "all"
              ? "Mudanças de membros aparecerão aqui assim que ocorrerem."
              : "Nenhum evento corresponde ao filtro selecionado."
          }
        />
      ) : (
        <ul className="divide-y divide-border/20 max-h-[420px] overflow-y-auto scrollbar-thin">
          <AnimatePresence initial={false}>
            {filtered.map((e) => {
              const meta = ACTION_META[e.action];
              const Icon = meta.icon;
              const actorName = labelFor(e.actor_profile, e.actor_id, currentUserId);
              const isSelf = e.is_self_action;
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelected(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected(e);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Ver detalhes do evento"
                  className="p-3 flex items-start gap-3 hover:bg-secondary/15 cursor-pointer focus:outline-none focus:bg-secondary/20 focus:ring-1 focus:ring-primary/40 transition-colors"
                >
                  <div className={`h-8 w-8 rounded-md ring-1 flex items-center justify-center flex-shrink-0 ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {meta.label}
                      </Badge>
                      <span className="text-xs font-medium text-foreground truncate">
                        {describe(e, currentUserId)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {isSelf ? "Ação do próprio usuário" : `por ${actorName}`}
                      {" · "}
                      <time dateTime={e.created_at} title={new Date(e.created_at).toLocaleString("pt-BR")}>
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                      </time>
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="px-4 py-2 border-t border-border/30 bg-secondary/10 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-muted-foreground">
          {(data?.length ?? 0) > 0
            ? <>Eventos <span className="text-foreground/80 font-medium">{rangeStart}–{rangeEnd}</span>{hasMore || page > 0 ? <> · página {page + 1}</> : null}</>
            : "Sem registros nesta página."}
          {(filter !== "all" || search.trim().length > 0) && (data?.length ?? 0) !== filtered.length && (
            <> · <span className="text-warning">{filtered.length} após filtro/busca</span></>
          )}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || isFetching}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore || isFetching || isPlaceholderData}
            aria-label="Próxima página"
          >
            Próxima
            {isFetching && isPlaceholderData
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <MembershipAuditDetailSheet
        entry={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        currentUserId={currentUserId}
      />
    </div>
  );
});
MembershipAuditLog.displayName = "MembershipAuditLog";