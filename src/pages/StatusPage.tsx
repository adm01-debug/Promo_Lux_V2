import { Activity, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  STATE_LABEL,
  IMPACT_LABEL,
  INCIDENT_STATUS_LABEL,
  usePublicStatus,
  usePublicUptime,
  type ComponentState,
} from "@/hooks/useStatusPage";

const STATE_STYLE: Record<ComponentState, { dot: string; text: string; icon: typeof CheckCircle2 }> = {
  operational: { dot: "bg-success", text: "text-success", icon: CheckCircle2 },
  degraded: { dot: "bg-warning", text: "text-warning", icon: AlertTriangle },
  outage: { dot: "bg-destructive", text: "text-destructive", icon: XCircle },
  unknown: { dot: "bg-muted-foreground", text: "text-muted-foreground", icon: Clock },
};

function uptimeBarColor(pct: number | null) {
  if (pct === null) return "bg-muted";
  if (pct >= 99) return "bg-success";
  if (pct >= 95) return "bg-warning";
  return "bg-destructive";
}

export default function StatusPage() {
  const { data, isLoading, error } = usePublicStatus();
  const { data: uptime } = usePublicUptime(30);

  const overall = STATE_STYLE[data?.overall ?? "unknown"];
  const OverallIcon = overall.icon;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Status da plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Estado em tempo real das automacoes. Atualiza a cada minuto.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              Nao foi possivel carregar o status agora. Tente novamente em instantes.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <OverallIcon className={`h-6 w-6 ${overall.text}`} />
              <div>
                <p className={`text-base font-semibold ${overall.text}`}>
                  {STATE_LABEL[data?.overall ?? "unknown"]}
                </p>
                {data?.generated_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Verificado em {new Date(data.generated_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Componentes</h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
                  ))}
                </div>
              ) : (data?.components ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma execucao registrada nos ultimos 7 dias.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {(data?.components ?? []).map((c) => {
                    const st = STATE_STYLE[c.state];
                    return (
                      <li key={c.component} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{c.component}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.events_24h ?? 0} execucoes · {c.failures_24h ?? 0} falhas (24h)
                          </p>
                        </div>
                        <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${st.text}`}>
                          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                          {STATE_LABEL[c.state]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Uptime (30 dias)</h2>
              {(!uptime || uptime.length === 0) ? (
                <p className="text-xs text-muted-foreground">Sem historico suficiente ainda.</p>
              ) : (
                <>
                  <div className="flex items-end gap-0.5">
                    {uptime.map((d) => (
                      <div
                        key={d.day}
                        title={`${d.day}: ${d.uptime_pct ?? 0}% (${d.failures} falhas de ${d.events})`}
                        className={`h-8 flex-1 rounded-sm ${uptimeBarColor(d.uptime_pct)}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{uptime[0]?.day}</span>
                    <span>{uptime[uptime.length - 1]?.day}</span>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Incidentes (30 dias)</h2>
              {(data?.incidents ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum incidente registrado no periodo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data?.incidents ?? []).map((i) => (
                    <li key={i.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{i.title}</p>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            i.status === "resolved"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {INCIDENT_STATUS_LABEL[i.status]}
                        </span>
                      </div>
                      {i.body && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{i.body}</p>
                      )}
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Impacto {IMPACT_LABEL[i.impact]} · iniciado em{" "}
                        {new Date(i.started_at).toLocaleString("pt-BR")}
                        {i.resolved_at && ` · resolvido em ${new Date(i.resolved_at).toLocaleString("pt-BR")}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <footer className="flex items-center gap-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <Activity className="h-3 w-3" /> Estado derivado das execucoes reais de automacao.
        </footer>
      </div>
    </div>
  );
}