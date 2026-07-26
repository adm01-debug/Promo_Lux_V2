import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { downloadCSV } from "@/lib/exportCSV";
import { SlaHistoryTrendChart } from "./SlaHistoryTrendChart";
import { toast } from "sonner";
import { History, ArrowRight, Download, Loader2 } from "lucide-react";


interface SlaHistoryRow {
  id: string;
  queue_kind: string;
  old_sla_seconds: number | null;
  new_sla_seconds: number;
  source: string;
  created_at: string;
}

const LABELS: Record<string, string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

const SOURCES: Record<string, string> = {
  manual: "Manual",
  recommendation: "Recomendação",
  seed: "Inicial",
};

const PERIODS: Array<{ value: string; label: string; days: number | null }> = [
  { value: "7", label: "Últimos 7 dias", days: 7 },
  { value: "30", label: "Últimos 30 dias", days: 30 },
  { value: "90", label: "Últimos 90 dias", days: 90 },
  { value: "all", label: "Todo o período", days: null },
];

/** Tamanho de cada página do histórico. */
const PAGE_SIZE = 30;
/** Teto defensivo: evita render de listas gigantes no cliente. */
const MAX_ROWS = 300;

/** Histórico auditável de alterações do SLA padrão por fila. */
export function SlaHistoryCard() {
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [limit, setLimit] = useState<number>(PAGE_SIZE);

  const periodDays = PERIODS.find((p) => p.value === periodFilter)?.days ?? null;
  const sinceIso = periodDays
    ? new Date(Date.now() - periodDays * 86_400_000).toISOString()
    : null;

  /** Troca de filtro reinicia a paginação — evita exibir página N de outro recorte. */
  function handleQueueChange(value: string) {
    setQueueFilter(value);
    setLimit(PAGE_SIZE);
  }

  function handlePeriodChange(value: string) {
    setPeriodFilter(value);
    setLimit(PAGE_SIZE);
  }

  /** Aplica os filtros ativos a uma query de `queue_sla_history`. */
  function applyFilters<T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T }>(q: T): T {
    let out = q;
    if (queueFilter !== "all") out = out.eq("queue_kind", queueFilter);
    if (sinceIso) out = out.gte("created_at", sinceIso);
    return out;
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["queue-sla-history", queueFilter, periodFilter, limit],
    queryFn: async () => {
      const { data, error } = await applyFilters(
        supabase
          .from("queue_sla_history")
          .select("id, queue_kind, old_sla_seconds, new_sla_seconds, source, created_at"),
      )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SlaHistoryRow[];
    },
    staleTime: 60_000,
    // Mantém a lista visível enquanto a próxima página carrega (sem flicker).
    placeholderData: (prev) => prev,
  });

  /** Só há mais páginas se a última resposta veio cheia e ainda cabe no teto. */
  const hasMore = (data?.length ?? 0) >= limit && limit < MAX_ROWS;


  const [exporting, setExporting] = useState(false);


  /** Exporta o histórico filtrado (até 1000 registros) em CSV. */
  async function handleExport() {
    setExporting(true);
    try {
      const { data: rows, error: exportError } = await applyFilters(
        supabase
          .from("queue_sla_history")
          .select("queue_kind, old_sla_seconds, new_sla_seconds, source, created_at"),
      )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (exportError) throw exportError;
      if (!rows || rows.length === 0) {
        toast.info("Nada para exportar", {
          description: "Nenhuma alteração de SLA no filtro selecionado.",
        });
        return;
      }

      downloadCSV(
        rows.map((r) => ({
          fila: LABELS[r.queue_kind] ?? r.queue_kind,
          fila_id: r.queue_kind,
          sla_anterior_s: r.old_sla_seconds ?? "",
          sla_novo_s: r.new_sla_seconds,
          origem: SOURCES[r.source] ?? r.source,
          data: new Date(r.created_at).toLocaleString("pt-BR"),
          data_iso: r.created_at,
        })),
        `historico-sla-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success("Exportação concluída", { description: `${rows.length} registro(s) em CSV.` });
    } catch (err) {
      toast.error("Falha ao exportar", {
        description: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden />
            Histórico de SLA
          </CardTitle>
          <CardDescription>
            Últimas alterações do prazo padrão de enfileiramento, manuais ou pelo auto-ajuste diário.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={queueFilter} onValueChange={handleQueueChange}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filtrar por fila">
              <SelectValue placeholder="Fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filas</SelectItem>
              {Object.entries(LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filtrar por período">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Exportar histórico de SLA em CSV"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-2 hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </CardHeader>


      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            Falha ao carregar histórico: {(error as Error).message}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <>
            <SlaHistoryTrendChart rows={data} />
            <ul className="divide-y">
            {data.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">

                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {LABELS[row.queue_kind] ?? row.queue_kind}
                  </span>
                  <Badge variant="outline">{SOURCES[row.source] ?? row.source}</Badge>
                </div>
                <div className="flex items-center gap-2 font-mono text-muted-foreground">
                  <span>{row.old_sla_seconds ?? "—"}s</span>
                  <ArrowRight className="h-3 w-3" aria-hidden />
                  <span className="text-foreground">{row.new_sla_seconds}s</span>
                </div>
                <time dateTime={row.created_at} className="shrink-0 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
            </ul>
            {hasMore && (
              <div className="pt-3 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))}
                  disabled={isFetching}
                >
                  {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Carregar mais
                </Button>
              </div>
            )}
            <p className="pt-2 text-center text-xs text-muted-foreground">
              {data.length} registro(s) exibido(s)
              {!hasMore && limit >= MAX_ROWS ? " — use a exportação CSV para o histórico completo." : ""}
            </p>
          </>


        )}
      </CardContent>
    </Card>
  );
}
