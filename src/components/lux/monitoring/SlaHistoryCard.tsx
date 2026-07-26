import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight } from "lucide-react";

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

/** Histórico auditável de alterações do SLA padrão por fila. */
export function SlaHistoryCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["queue-sla-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_sla_history")
        .select("id, queue_kind, old_sla_seconds, new_sla_seconds, source, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SlaHistoryRow[];
    },
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" aria-hidden />
          Histórico de SLA
        </CardTitle>
        <CardDescription>
          Últimas alterações do prazo padrão de enfileiramento, manuais ou pelo auto-ajuste diário.
        </CardDescription>
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
        )}
      </CardContent>
    </Card>
  );
}
