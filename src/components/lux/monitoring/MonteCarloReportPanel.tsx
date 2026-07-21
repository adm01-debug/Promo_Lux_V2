import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useResilienceComparison } from "@/hooks/useResilienceComparison";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const sec = (v: number) => `${v.toFixed(1)}s`;
const ppt = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`;

export const MonteCarloReportPanel = () => {
  const { data: report, isLoading, error } = useResilienceComparison();

  const worst5 = useMemo(() => {
    if (!report) return [];
    return [...report.rows]
      .filter((r) => r.current)
      .sort((a, b) => (a.current!.successRate) - (b.current!.successRate))
      .slice(0, 5);
  }, [report]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando relatório Monte Carlo…
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">
          Erro ao carregar snapshots: {(error as Error)?.message ?? "desconhecido"}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Verifique se <code>public/reports/baseline.json</code> e{" "}
          <code>public/reports/current.json</code> existem.
        </p>
      </Card>
    );
  }

  const { aggregate: a } = report;
  const successUp = a.deltaAvgSuccess >= 0;
  const dlqDown = a.deltaAvgDlq <= 0;
  const p95Down = a.deltaAvgP95 <= 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Relatórios Monte Carlo</h2>
        <p className="text-xs text-muted-foreground">
          Comparativo {report.baselineLabel} → {report.currentLabel} · {report.rows.length} cenários
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <CardDescription className="text-xs">Sucesso médio</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {pct(a.baselineAvgSuccess)} →{" "}
            <span className="font-semibold">{pct(a.currentAvgSuccess)}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-mono ${
              successUp ? "text-success" : "text-destructive"
            }`}
          >
            {successUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {ppt(a.deltaAvgSuccess)}
          </span>
        </Card>
        <Card className="p-4">
          <CardDescription className="text-xs">DLQ média</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {pct(a.baselineAvgDlq)} →{" "}
            <span className="font-semibold">{pct(a.currentAvgDlq)}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-mono ${
              dlqDown ? "text-success" : "text-destructive"
            }`}
          >
            {ppt(a.deltaAvgDlq)}
          </span>
        </Card>
        <Card className="p-4">
          <CardDescription className="text-xs">p95 médio</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {sec(a.baselineAvgP95)} →{" "}
            <span className="font-semibold">{sec(a.currentAvgP95)}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-mono ${
              p95Down ? "text-success" : "text-destructive"
            }`}
          >
            {a.deltaAvgP95 >= 0 ? "+" : ""}
            {a.deltaAvgP95.toFixed(1)}s
          </span>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 5 piores cenários (atual)</CardTitle>
          <CardDescription>Ordenados pela menor taxa de sucesso no snapshot atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground border-b border-border/50">
              <tr>
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Cenário</th>
                <th className="py-2 px-2 text-right">Sucesso</th>
                <th className="py-2 px-2 text-right">Δ Sucesso</th>
                <th className="py-2 px-2 text-right">p95</th>
                <th className="py-2 px-2 text-right">DLQ</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {worst5.map((r, i) => (
                <tr key={r.id} className="border-b border-border/20">
                  <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-2 truncate max-w-[320px]" title={r.id}>
                    {r.id}
                  </td>
                  <td className="py-2 px-2 text-right">{pct(r.current!.successRate)}</td>
                  <td
                    className={`py-2 px-2 text-right ${
                      r.deltaSuccessRate >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {ppt(r.deltaSuccessRate)}
                  </td>
                  <td className="py-2 px-2 text-right">{sec(r.current!.p95)}</td>
                  <td className="py-2 px-2 text-right">{pct(r.current!.dlqRate)}</td>
                </tr>
              ))}
              {worst5.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-muted-foreground">
                    Sem dados no snapshot atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              Total: {report.rows.length}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
              Melhoraram: {a.counts.improved}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"
            >
              Regrediram: {a.counts.regressed}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Estáveis: {a.counts.stable}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonteCarloReportPanel;
