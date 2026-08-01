// MultiQueueResilienceCard — Panorama unificado das duas filas (scrape/web).
// Read-only: usa snapshots existentes + advisories + web_scrape_queue direta.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Globe, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";

type QueueKind = "scrape" | "web";

interface QueueSnapshot {
  kind: QueueKind;
  pending: number | null;
  capturedAt: string | null;
  advisoryPp: number | null;
  advisoryAt: string | null;
  success24h: number | null;
  sample24h: number;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function severityOfPending(n: number | null): "ok" | "warn" | "critical" {
  if (n == null) return "ok";
  if (n >= 100) return "critical";
  if (n >= 25) return "warn";
  return "ok";
}

async function fetchSnapshot(kind: QueueKind): Promise<QueueSnapshot> {
  const [snap, adv, web24] = await Promise.all([
    supabase
      .from("dlq_health_snapshots")
      .select("pending_items, captured_at")
      .eq("queue_kind", kind)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("retry_policy_advisories")
      .select("improvement_pp, created_at")
      .eq("queue_kind", kind)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    kind === "web"
      ? supabase
          .from("web_scrape_queue")
          .select("status")
          .gte("updated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .in("status", ["succeeded", "failed", "dead"])
          .limit(5000)
      : Promise.resolve({ data: null }),
  ]);

  let success24h: number | null = null;
  let sample24h = 0;
  if (kind === "web" && Array.isArray((web24 as { data: unknown }).data)) {
    const rows = (web24 as { data: { status: string }[] }).data;
    sample24h = rows.length;
    if (sample24h > 0) {
      const ok = rows.filter((r) => r.status === "succeeded").length;
      success24h = ok / sample24h;
    }
  }

  return {
    kind,
    pending: (snap.data as { pending_items: number } | null)?.pending_items ?? null,
    capturedAt: (snap.data as { captured_at: string } | null)?.captured_at ?? null,
    advisoryPp: (adv.data as { improvement_pp: number } | null)?.improvement_pp ?? null,
    advisoryAt: (adv.data as { created_at: string } | null)?.created_at ?? null,
    success24h,
    sample24h,
  };
}

function QueueRow({ s }: { s: QueueSnapshot }) {
  const sev = severityOfPending(s.pending);
  const Icon = s.kind === "web" ? Globe : Layers;
  const label = s.kind === "web" ? "Motor Web Nativo" : "Fila de Scrape (legada)";
  const sevColor =
    sev === "critical" ? "text-destructive" : sev === "warn" ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">
            {s.capturedAt ? `Snapshot: ${new Date(s.capturedAt).toLocaleString("pt-BR")}` : "Sem snapshot"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className={`h-4 w-4 ${sevColor}`} />
          <span className="text-muted-foreground">DLQ pendente:</span>
          <span className="font-mono font-semibold text-foreground">{s.pending ?? "—"}</span>
        </div>
        {s.kind === "web" && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">Sucesso 24h:</span>
            <span className="font-mono font-semibold text-foreground">
              {fmtPct(s.success24h)}{" "}
              <span className="text-xs text-muted-foreground">(n={s.sample24h})</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Advisory:</span>
          {s.advisoryPp != null ? (
            <Badge variant="secondary" className="font-mono">
              +{(s.advisoryPp * 100).toFixed(1)} pp
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">nenhum</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MultiQueueResilienceCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["multi-queue-resilience"],
    queryFn: async () => {
      const [scrape, web] = await Promise.all([fetchSnapshot("scrape"), fetchSnapshot("web")]);
      return { scrape, web };
    },
    refetchInterval: 60_000,
  });

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Resiliência Multi-Fila
        </CardTitle>
        <CardDescription>
          Panorama unificado dos motores de raspagem: DLQ, advisories de retry e taxa de sucesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground">Carregando snapshots…</div>
        ) : (
          <>
            <QueueRow s={data.scrape} />
            <QueueRow s={data.web} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
