import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gauge, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SlaRecommendationRowItem } from "./SlaRecommendationRowItem";

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

interface QueueSlaDefault {
  queue_kind: string;
  sla_seconds: number;
  auto_tune: boolean;
  source: string;
  last_applied_at: string | null;
}

const HOURS_OPTIONS = [24, 72, 168, 720];

const HEADERS = [
  "Fila",
  "Amostra",
  "p50 real",
  "p95 real",
  "SLA atual",
  "Padrão enqueue",
  "Sugerido",
  "Veredito",
  "Auto-ajuste",
] as const;

export function SlaRecommendationsCard() {
  const [hours, setHours] = useState<number>(168);
  const [applying, setApplying] = useState<string | null>(null);
  const [togglingAutoTune, setTogglingAutoTune] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const { data: defaults } = useQuery({
    queryKey: ["queue-sla-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_sla_defaults")
        .select("queue_kind, sla_seconds, auto_tune, source, last_applied_at");
      if (error) throw error;
      return (data ?? []) as QueueSlaDefault[];
    },
    staleTime: 60_000,
  });

  const applyMutation = useMutation({
    mutationFn: async (queueKind: SlaRecommendationRow["queue_kind"]) => {
      const { data, error } = await supabase.rpc("apply_sla_recommendation", {
        p_queue_kind: queueKind,
        p_hours: hours,
      });
      if (error) throw error;
      return data;
    },
    onMutate: (queueKind) => setApplying(queueKind),
    onSuccess: () => {
      toast.success("SLA padrão atualizado", {
        description: "Novas tarefas enfileiradas já usarão o prazo recomendado.",
      });
      queryClient.invalidateQueries({ queryKey: ["queue-sla-defaults"] });
    },
    onError: (err: Error) => {
      toast.error("Não foi possível aplicar o SLA", { description: err.message });
    },
    onSettled: () => setApplying(null),
  });

  const autoTuneMutation = useMutation({
    mutationFn: async (vars: {
      queueKind: SlaRecommendationRow["queue_kind"];
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("queue_sla_defaults")
        .update({ auto_tune: vars.enabled })
        .eq("queue_kind", vars.queueKind);
      if (error) throw error;
      return vars;
    },
    onMutate: (vars) => setTogglingAutoTune(vars.queueKind),
    onSuccess: (vars) => {
      toast.success(
        vars.enabled ? "Auto-ajuste ativado" : "Auto-ajuste desativado",
        {
          description: vars.enabled
            ? "A rotina diária poderá reajustar o SLA desta fila automaticamente."
            : "O SLA desta fila só mudará manualmente.",
        },
      );
      queryClient.invalidateQueries({ queryKey: ["queue-sla-defaults"] });
    },
    onError: (err: Error) => {
      toast.error("Não foi possível alterar o auto-ajuste", { description: err.message });
      queryClient.invalidateQueries({ queryKey: ["queue-sla-defaults"] });
    },
    onSettled: () => setTogglingAutoTune(null),
  });

  const rowDefault = (kind: string) => defaults?.find((d) => d.queue_kind === kind) ?? null;
  const defaultFor = (kind: string) => rowDefault(kind)?.sla_seconds ?? null;
  const autoTuneFor = (kind: string) => rowDefault(kind)?.auto_tune ?? false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" aria-hidden />
            Recomendação de SLA
          </CardTitle>
          <CardDescription>
            Compara o tempo real (p95) com o prazo configurado, sugere o ideal (p95 × 1,3) e permite
            aplicá-lo como padrão de enfileiramento.
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
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="py-2 text-right font-medium">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <SlaRecommendationRowItem
                    key={row.queue_kind}
                    row={row}
                    currentDefault={defaultFor(row.queue_kind)}
                    autoTune={autoTuneFor(row.queue_kind)}
                    onApply={(kind) => applyMutation.mutate(kind)}
                    onToggleAutoTune={(kind, enabled) =>
                      autoTuneMutation.mutate({ queueKind: kind, enabled })
                    }
                    isApplying={applying === row.queue_kind}
                    isTogglingAutoTune={togglingAutoTune === row.queue_kind}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
