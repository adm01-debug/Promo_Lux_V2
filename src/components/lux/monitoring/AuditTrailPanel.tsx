import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Search, ChevronLeft, ChevronRight, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useAuditTrail,
  useAuditTables,
  DEFAULT_AUDIT_FILTERS,
  type AuditTrailFilters,
  type AuditActionFilter,
} from "@/hooks/useAuditTrail";

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Alteração",
  delete: "Remoção",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

/**
 * Painel da "Trilha de Auditoria": mostra quem executou quais ações (incluindo
 * automações) e quais entidades foram alteradas, com filtros por entidade,
 * tipo de ação, busca por ator e paginação no servidor.
 */
export function AuditTrailPanel() {
  const [filters, setFilters] = useState<AuditTrailFilters>(DEFAULT_AUDIT_FILTERS);
  const { data, isLoading, isFetching, refetch } = useAuditTrail(filters);
  const { data: tables } = useAuditTables();

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const patch = (p: Partial<AuditTrailFilters>) =>
    setFilters((f) => ({ ...f, page: 1, ...p }));

  return (
    <Card className="glass border-border/40 overflow-hidden">
      <CardHeader className="bg-secondary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              Trilha de Auditoria
            </CardTitle>
            <CardDescription>
              Quem executou cada ação e quais entidades foram alteradas — inclusive automações.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 gap-2 border-border/40"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder="Buscar por ator ou entidade"
              className="h-9 pl-8 bg-background/60"
              aria-label="Buscar na trilha de auditoria"
            />
          </div>

          <Select value={filters.table} onValueChange={(v) => patch({ table: v })}>
            <SelectTrigger className="h-9 bg-background/60" aria-label="Filtrar por entidade">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              <SelectItem value="automations">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Somente automações
                </span>
              </SelectItem>
              {(tables ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.action}
            onValueChange={(v) => patch({ action: v as AuditActionFilter })}
          >
            <SelectTrigger className="h-9 bg-background/60" aria-label="Filtrar por ação">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Alteração</SelectItem>
              <SelectItem value="delete">Remoção</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(filters.pageSize)}
            onValueChange={(v) => patch({ pageSize: Number(v) })}
          >
            <SelectTrigger className="h-9 bg-background/60" aria-label="Itens por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} por página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[560px]">
          <div className="divide-y divide-border/20">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 w-full bg-muted/50 animate-pulse" />
              ))
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                Nenhum registro de auditoria encontrado para os filtros atuais.
              </div>
            ) : (
              rows.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 hover:bg-secondary/10 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border/30 overflow-hidden">
                    {log.actor?.avatar_url ? (
                      <img src={log.actor.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"} className="text-[10px]">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                        em{" "}
                        <span className="font-mono bg-secondary/50 px-1 rounded text-xs">
                          {log.table_name}
                        </span>
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-secondary/30 px-2 py-0.5 rounded-full border border-border/20">
                        {format(new Date(log.created_at), "HH:mm:ss · dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      Ator:{" "}
                      <span className="text-foreground/80 font-medium">
                        {log.actor?.full_name || "Sistema"}
                      </span>
                      {log.actor_id && (
                        <span className="text-[10px] opacity-40">({log.actor_id.slice(0, 8)})</span>
                      )}
                      <span className="opacity-40">·</span>
                      <span className="font-mono text-[10px] opacity-60">
                        registro {log.record_id.slice(0, 8)}
                      </span>
                    </p>
                    {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                      <div className="mt-2 text-[10px] font-mono p-3 bg-black/40 rounded-lg border border-white/5 overflow-x-auto text-primary/80">
                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 bg-secondary/10 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {total} registro{total === 1 ? "" : "s"} · página {filters.page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-border/40"
              disabled={filters.page <= 1 || isFetching}
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-border/40"
              disabled={filters.page >= totalPages || isFetching}
              onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
