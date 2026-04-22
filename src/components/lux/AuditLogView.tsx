import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ScrollText, Plus, Pencil, Trash2, Filter, Search, ChevronDown, ChevronRight, Building2, Mail, Workflow, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLogs, type AuditAction, type AuditTable, type AuditLog } from "@/hooks/useAuditLogs";
import { EmptyState } from "@/components/lux/EmptyState";
import { DataError } from "@/components/lux/DataError";

const ACTION_META: Record<AuditAction, { label: string; icon: typeof Plus; cls: string }> = {
  create: { label: "Criou", icon: Plus, cls: "bg-success/15 text-success border-success/30" },
  update: { label: "Editou", icon: Pencil, cls: "bg-info/15 text-info border-info/30" },
  delete: { label: "Excluiu", icon: Trash2, cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

const TABLE_META: Record<string, { label: string; icon: typeof Building2 }> = {
  companies: { label: "Empresa", icon: Building2 },
  campaigns: { label: "Campanha", icon: Mail },
  workflows: { label: "Workflow", icon: Workflow },
};

function diffKeys(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];
  const skip = new Set(["updated_at", "created_at"]);
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed: string[] = [];
  keys.forEach((k) => {
    if (skip.has(k)) return;
    if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) changed.push(k);
  });
  return changed;
}

function entityLabel(log: AuditLog): string {
  const data = log.new_data ?? log.old_data;
  if (!data) return log.record_id.slice(0, 8) + "…";
  return (data.name as string) ?? (data.title as string) ?? log.record_id.slice(0, 8) + "…";
}

const LogRow = ({ log, index }: { log: AuditLog; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action];
  const tableMeta = TABLE_META[log.table_name] ?? { label: log.table_name, icon: ScrollText };
  const ActionIcon = meta.icon;
  const TableIcon = tableMeta.icon;
  const changes = log.action === "update" ? diffKeys(log.old_data, log.new_data) : [];
  const hasDetails = log.action === "update" ? changes.length > 0 : !!(log.old_data || log.new_data);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="border-b border-border/20 last:border-0"
    >
      <button
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${hasDetails ? "hover:bg-secondary/20 cursor-pointer" : "cursor-default"}`}
      >
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
          <ActionIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
            <Badge variant="outline" className="text-[10px] gap-1 bg-secondary/40 border-border/40">
              <TableIcon className="h-3 w-3" /> {tableMeta.label}
            </Badge>
            <span className="text-sm font-medium text-foreground truncate">{entityLabel(log)}</span>
            {log.action === "update" && changes.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-muted/30 border-border/40 text-muted-foreground">
                {changes.length} {changes.length === 1 ? "campo" : "campos"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
            <span>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            <span>·</span>
            <span>actor {log.actor_id?.slice(0, 8) ?? "system"}…</span>
            <span>·</span>
            <span>id {log.record_id.slice(0, 8)}…</span>
          </div>
        </div>
        {hasDetails && (
          <div className="flex-shrink-0 text-muted-foreground mt-1">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        )}
      </button>
      {expanded && hasDetails && (
        <div className="px-4 pb-4 pl-15">
          {log.action === "update" ? (
            <div className="space-y-2">
              {changes.map((field) => (
                <div key={field} className="rounded-lg border border-border/30 bg-secondary/20 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{field}</p>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="text-destructive/80 truncate">
                      <span className="text-[9px] text-muted-foreground block uppercase">Antes</span>
                      {JSON.stringify(log.old_data?.[field] ?? null)}
                    </div>
                    <div className="text-success/80 truncate">
                      <span className="text-[9px] text-muted-foreground block uppercase">Depois</span>
                      {JSON.stringify(log.new_data?.[field] ?? null)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="rounded-lg border border-border/30 bg-secondary/20 p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-60">
              {JSON.stringify(log.new_data ?? log.old_data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </motion.div>
  );
};

export const AuditLogView = () => {
  const [tableFilter, setTableFilter] = useState<AuditTable | "all">("all");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [search, setSearch] = useState("");

  const { data: logs, isLoading, error, refetch } = useAuditLogs({
    table: tableFilter,
    action: actionFilter,
    limit: 200,
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) => {
      const label = entityLabel(l).toLowerCase();
      return label.includes(q) || l.record_id.includes(q) || (l.actor_id ?? "").includes(q);
    });
  }, [logs, search]);

  if (error) return <DataError message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          Audit Log
          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30 ml-1">
            <Lock className="h-3 w-3" /> Imutável
          </Badge>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Registro permanente de quem criou, editou ou excluiu empresas, campanhas e workflows. Não pode ser alterado nem apagado.
        </p>
      </div>

      <div className="glass rounded-lg p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, ID ou ator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={tableFilter} onValueChange={(v) => setTableFilter(v as typeof tableFilter)}>
            <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              <SelectItem value="companies">Empresas</SelectItem>
              <SelectItem value="campaigns">Campanhas</SelectItem>
              <SelectItem value="workflows">Workflows</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
            <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="create">Criar</SelectItem>
              <SelectItem value="update">Editar</SelectItem>
              <SelectItem value="delete">Excluir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nenhum registro encontrado"
            description="Ainda não há eventos registrados com os filtros atuais. Crie ou edite uma empresa, campanha ou workflow para gerar o primeiro registro."
          />
        ) : (
          <div>
            {filtered.map((log, i) => <LogRow key={log.id} log={log} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};
