import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, GitCompare, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  buildReportCsv,
  compareSources,
  queuesFromRows,
  totalsForSource,
  type SourceQualityRow,
} from "@/lib/sourceQualityReport";
import { SourceComparisonSummary } from "./SourceComparisonSummary";
import { SourceComparisonTable } from "./SourceComparisonTable";

type Bucket = "day" | "week" | "month";

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

const BUCKETS: { value: Bucket; label: string }[] = [
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
];

const ALL_QUEUES = "__all__";

/** Relatório Lusha × Apollo: e-mail confirmado, cobertura BR e supressão por período e fila. */
export function SourceComparisonReport() {
  const [days, setDays] = useState<string>("30");
  const [bucket, setBucket] = useState<Bucket>("day");
  const [queue, setQueue] = useState<string>(ALL_QUEUES);

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - Number(days) * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [days]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["source-quality-report", range.start, bucket, queue],
    queryFn: async (): Promise<SourceQualityRow[]> => {
      const { data, error } = await supabase.rpc("source_quality_report", {
        p_start: range.start,
        p_end: range.end,
        p_bucket: bucket,
        p_queue: queue === ALL_QUEUES ? undefined : queue,
      });
      if (error) throw error;
      return (data ?? []) as SourceQualityRow[];
    },
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const lusha = useMemo(() => totalsForSource(rows, "lusha"), [rows]);
  const apollo = useMemo(() => totalsForSource(rows, "apollo"), [rows]);
  const delta = useMemo(() => compareSources(lusha, apollo), [lusha, apollo]);
  const queues = useMemo(() => queuesFromRows(rows), [rows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("Nada para exportar no período selecionado.");
      return;
    }
    const blob = new Blob([buildReportCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lusha-vs-apollo-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Lusha × Apollo — ganho do fallback
          </CardTitle>
          <CardDescription>
            Taxa de e-mail confirmado, cobertura Brasil e supressão por período e fila.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px]" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bucket} onValueChange={(value) => setBucket(value as Bucket)}>
            <SelectTrigger className="w-[130px]" aria-label="Granularidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUCKETS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={queue} onValueChange={setQueue}>
            <SelectTrigger className="w-[170px]" aria-label="Fila">
              <SelectValue placeholder="Todas as filas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUEUES}>Todas as filas</SelectItem>
              {queues.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="sr-only">Atualizar relatório</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="py-6 text-center text-sm text-destructive">
            Falha ao carregar o relatório: {(error as Error).message}
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <SourceComparisonSummary lusha={lusha} apollo={apollo} delta={delta} />
            <SourceComparisonTable rows={rows} bucket={bucket} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
