import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/lux/EmptyState";
import { useDlqItems, useReplayDlqBatch } from "@/hooks/useDlqItems";
import {
  DLQ_CATEGORIES,
  dlqCategoryLabel,
  type DlqReasonCategory,
} from "@/lib/dlq/classify";

const CATEGORY_COLOR: Record<DlqReasonCategory, string> = {
  network: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  rate_limit: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  auth: "bg-destructive/15 text-destructive border-destructive/30",
  not_found: "bg-muted/50 text-muted-foreground border-border/40",
  server: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  validation: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  unknown: "bg-muted/50 text-muted-foreground border-border/40",
};

export const DlqTriageView = () => {
  const { data: items = [], isLoading, refetch, isFetching } = useDlqItems(300);
  const replay = useReplayDlqBatch();
  const [filter, setFilter] = useState<DlqReasonCategory | "all">("all");

  const counts = useMemo(() => {
    const m = new Map<DlqReasonCategory, number>();
    for (const it of items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
    return m;
  }, [items]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.category === filter)),
    [items, filter]
  );

  const doReplay = async () => {
    try {
      const n = await replay.mutateAsync({ limit: 500 });
      toast.success(`${n} item(s) reprocessado(s)`);
    } catch (err) {
      toast.error(`Falha ao reprocessar: ${err instanceof Error ? err.message : "erro"}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Dead Letter Queue — Triagem</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Classificação automática do último erro. Itens retriáveis podem ser reprocessados em lote.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as DlqReasonCategory | "all")}>
              <SelectTrigger className="w-[220px] h-9 text-xs">
                <SelectValue placeholder="Filtrar por causa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as causas ({items.length})</SelectItem>
                {DLQ_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {dlqCategoryLabel(c)} ({counts.get(c) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={doReplay}
              disabled={replay.isPending || items.length === 0}
              className="gap-1.5"
            >
              {replay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Reprocessar lote
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Nenhum item na DLQ"
            description={filter === "all"
              ? "Todos os jobs estão sendo processados normalmente."
              : "Nenhum item na categoria selecionada."}
          />
        ) : (
          <div className="rounded-md border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Causa provável</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Falhou há</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLOR[item.category]}`}>
                        {item.categoryLabel}
                      </Badge>
                      {!item.retryable && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">não retriável</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{item.source}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{item.attempts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate" title={item.last_error ?? ""}>
                      {item.last_error ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.failed_at), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 100 && (
              <div className="p-2 text-center text-[11px] text-muted-foreground border-t border-border/40">
                Exibindo 100 de {filtered.length} itens. Use filtros para refinar.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
