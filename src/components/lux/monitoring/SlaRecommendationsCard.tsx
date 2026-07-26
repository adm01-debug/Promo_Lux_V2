import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gauge, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Linha retornada pelo RPC `sla_recommendations`. */
export interface SlaRecommendationRow {
  queue_kind: "scrape" | "web" | "instagram";
  sample_size: number;
  current_sla_p50: number | null;
  p50_seconds: number | null;
  p95_seconds: number | null;
  recommended_sla_seconds: number | null;
  delta_seconds: number | null;
  verdict: "insufficient_data" | "unset" | "too_tight" | "too_loose" | "ok";
}

const HOURS_OPTIONS = [24, 72, 168, 720];

const LABELS: Record<SlaRecommendationRow["queue_kind"], string> = {
  scrape: "Scrape (legado)",
  web: "Web Scrape",
  instagram: "Instagram",
};

const VERDICTS: Record<
  SlaRecommendationRow["verdict"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  too_tight: { label: "Apertado demais", variant: "destructive" },
  too_loose: { label: "Folgado demais", variant: "secondary" },
  ok: { label: "Adequado", variant: "default" },
  unset: { label: "Sem SLA definido", variant: "outline" },
  insufficient_data: { label: "Amostra insuficiente", variant: "outline" },
};

function fmtSeconds(value: number | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n >= 60 ? `${(n / 60).toFixed(1)}m` : `${n.toFixed(1)}s`;
}

export function SlaRecommendationsCard() {
  const [hours, setHours] = useState<number>(168);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["sla-recommendations", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sla_recommendations", { p_hours: hours });
      if (error) throw error;
      return (data ?? []) as SlaRecommendationRow[];
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" aria-hidden />
            Recomendação de SLA
          </CardTitle>
          <CardDescription>
            Compara o tempo real (p95) de conclusão com o prazo configurado e sugere o valor ideal
            (p95 × 1,3).
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Janela de análise">
            {HOURS_OPTIONS.map((h) => (
              <Button
                key={h}
                size="sm"
                variant={hours === h ? "default" : "outline"}
                onClick={() => setHours(h)}
                aria-pressed={hours === h}
              >
                {h >= 168 ? `${Math.round(h / 24)}d` : `${h}h`}
              </Button>
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => refetch()}
            aria-label="Atualizar recomendações"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            Falha ao carregar recomendações: {(error as Error).message}
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tarefa concluída na janela selecionada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recomendações de SLA por fila</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Fila</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Amostra</th>
                  <th scope="col" className="py-2 pr-3 font-medium">p50 real</th>
                  <th scope="col" className="py-2 pr-3 font-medium">p95 real</th>
                  <th scope="col" className="py-2 pr-3 font-medium">SLA atual</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sugerido</th>
                  <th scope="col" className="py-2 font-medium">Veredito</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const verdict = VERDICTS[row.verdict] ?? VERDICTS.insufficient_data;
                  return (
                    <tr key={row.queue_kind} className="border-b last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">
                        {LABELS[row.queue_kind] ?? row.queue_kind}
                      </th>
                      <td className="py-2 pr-3 text-muted-foreground">{row.sample_size}</td>
                      <td className="py-2 pr-3">{fmtSeconds(row.p50_seconds)}</td>
                      <td className="py-2 pr-3">{fmtSeconds(row.p95_seconds)}</td>
                      <td className="py-2 pr-3">{fmtSeconds(row.current_sla_p50)}</td>
                      <td className="py-2 pr-3 font-mono text-foreground">
                        {fmtSeconds(row.recommended_sla_seconds)}
                      </td>
                      <td className="py-2">
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
