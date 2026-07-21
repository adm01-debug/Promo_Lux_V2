import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingUp, TrendingDown, Minus, Download, FileJson, FileSpreadsheet } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useResilienceComparison } from "@/hooks/useResilienceComparison";
import { buildCsv, downloadCsv } from "@/lib/csv";
import type { ComparisonReport, ComparisonRow, Classification } from "@/lib/resilience/compareReport";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const ppt = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`;
const sec = (v: number) => `${v.toFixed(1)}s`;

const classBadge: Record<Classification, { label: string; className: string }> = {
  improved:  { label: "Melhorou",  className: "bg-success/15 text-success border-success/30" },
  regressed: { label: "Regrediu",  className: "bg-destructive/15 text-destructive border-destructive/30" },
  stable:    { label: "Estável",   className: "bg-muted text-muted-foreground border-border/40" },
  new:       { label: "Novo",      className: "bg-primary/15 text-primary border-primary/30" },
  removed:   { label: "Removido",  className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
};

function DeltaLabel({ value, kind }: { value: number; kind: "positive-good" | "positive-bad" }) {
  const good = kind === "positive-good" ? value > 0 : value < 0;
  const bad = kind === "positive-good" ? value < 0 : value > 0;
  const Icon = value === 0 ? Minus : good ? TrendingUp : TrendingDown;
  const cls = good ? "text-success" : bad ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${cls}`}>
      <Icon className="h-3 w-3" />
      {ppt(value)}
    </span>
  );
}

function downloadJson(report: ComparisonReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resilience-comparison-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(rows: ComparisonRow[]) {
  const headers = [
    "cenario", "successBaseline", "successAtual", "deltaSuccessPp",
    "p95Baseline_s", "p95Atual_s", "deltaP95_s",
    "dlqBaseline", "dlqAtual", "deltaDlqPp", "classificacao",
  ];
  const data = rows.map((r) => [
    r.id,
    r.baseline ? (r.baseline.successRate * 100).toFixed(2) : "",
    r.current ? (r.current.successRate * 100).toFixed(2) : "",
    (r.deltaSuccessRate * 100).toFixed(2),
    r.baseline ? r.baseline.p95.toFixed(1) : "",
    r.current ? r.current.p95.toFixed(1) : "",
    r.deltaP95.toFixed(1),
    r.baseline ? (r.baseline.dlqRate * 100).toFixed(2) : "",
    r.current ? (r.current.dlqRate * 100).toFixed(2) : "",
    (r.deltaDlqRate * 100).toFixed(2),
    r.classification,
  ]);
  downloadCsv(`resilience-comparison-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  // buildCsv exportado apenas para uso externo/testes.
  void buildCsv;
}

export const ResilienceReport = () => {
  const { data: report, isLoading, error } = useResilienceComparison();

  const worst20 = useMemo(() => {
    if (!report) return [];
    return [...report.rows]
      .filter((r) => r.baseline && r.current)
      .sort((a, b) => (a.current!.successRate) - (b.current!.successRate))
      .slice(0, 20)
      .map((r) => ({
        id: r.id.length > 22 ? r.id.slice(0, 20) + "…" : r.id,
        baseline: +(r.baseline!.successRate * 100).toFixed(1),
        atual: +(r.current!.successRate * 100).toFixed(1),
      }));
  }, [report]);

  const p95Series = useMemo(() => {
    if (!report) return [];
    return [...report.rows]
      .filter((r) => r.baseline && r.current)
      .sort((a, b) => b.deltaP95 - a.deltaP95)
      .slice(0, 30)
      .map((r, i) => ({
        idx: i + 1,
        baseline: +r.baseline!.p95.toFixed(1),
        atual: +r.current!.p95.toFixed(1),
      }));
  }, [report]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando comparativo…
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">Erro ao carregar snapshots: {(error as Error)?.message ?? "desconhecido"}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Verifique se <code>public/reports/baseline.json</code> e <code>public/reports/current.json</code> existem.
        </p>
      </Card>
    );
  }

  const { aggregate: a, rows } = report;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Relatório Comparativo de Resiliência</h2>
          <p className="text-xs text-muted-foreground">
            {report.baselineLabel} → {report.currentLabel} · {rows.length} cenários
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadJson(report)}>
            <FileJson className="h-4 w-4 mr-1" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv(rows)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <CardDescription className="text-xs">Taxa de sucesso média</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {pct(a.baselineAvgSuccess)} → <span className="text-foreground font-semibold">{pct(a.currentAvgSuccess)}</span>
          </div>
          <DeltaLabel value={a.deltaAvgSuccess} kind="positive-good" />
        </Card>
        <Card className="p-4">
          <CardDescription className="text-xs">DLQ média</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {pct(a.baselineAvgDlq)} → <span className="text-foreground font-semibold">{pct(a.currentAvgDlq)}</span>
          </div>
          <DeltaLabel value={a.deltaAvgDlq} kind="positive-bad" />
        </Card>
        <Card className="p-4">
          <CardDescription className="text-xs">p95 médio de resolução</CardDescription>
          <div className="mt-1 font-mono text-lg">
            {sec(a.baselineAvgP95)} → <span className="text-foreground font-semibold">{sec(a.currentAvgP95)}</span>
          </div>
          <span className={`inline-flex items-center gap-1 text-xs font-mono ${a.deltaAvgP95 < 0 ? "text-success" : a.deltaAvgP95 > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {a.deltaAvgP95 >= 0 ? "+" : ""}{a.deltaAvgP95.toFixed(1)}s
          </span>
        </Card>
        <Card className="p-4">
          <CardDescription className="text-xs">Cenários por classificação</CardDescription>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(a.counts) as Classification[])
              .filter((k) => a.counts[k] > 0)
              .map((k) => (
                <Badge key={k} variant="outline" className={`text-[10px] ${classBadge[k].className}`}>
                  {classBadge[k].label}: {a.counts[k]}
                </Badge>
              ))}
          </div>
        </Card>
      </div>

      {/* Gráfico de barras — 20 piores cenários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sucesso: 20 piores cenários (baseline vs. atual)</CardTitle>
          <CardDescription>Percentual de execuções que resolvem com sucesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={worst20}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="id" className="text-[9px]" interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis className="text-[10px]" domain={[0, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="baseline" fill="hsl(var(--muted-foreground))" name="Baseline" />
                <Bar dataKey="atual" fill="hsl(var(--primary))" name="Atual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de linhas — p95 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">p95 de resolução — 30 cenários com maior Δ</CardTitle>
          <CardDescription>Ordenados pela variação de p95 (piora à esquerda).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p95Series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="idx" className="text-[10px]" />
                <YAxis className="text-[10px]" unit="s" />
                <Tooltip formatter={(v: number) => `${v}s`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} name="Baseline" />
                <Line type="monotone" dataKey="atual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Atual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Todos os cenários ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[520px]">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground border-b border-border/50 sticky top-0 bg-background">
                <tr>
                  <th className="py-2 pr-2">Cenário</th>
                  <th className="py-2 px-2 text-right">Sucesso</th>
                  <th className="py-2 px-2 text-right">Δ Sucesso</th>
                  <th className="py-2 px-2 text-right">p95</th>
                  <th className="py-2 px-2 text-right">Δ p95</th>
                  <th className="py-2 px-2 text-right">DLQ</th>
                  <th className="py-2 px-2 text-right">Δ DLQ</th>
                  <th className="py-2 pl-2">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/30">
                    <td className="py-1.5 pr-2 truncate max-w-[240px]" title={r.id}>{r.id}</td>
                    <td className="py-1.5 px-2 text-right">
                      {r.baseline ? pct(r.baseline.successRate) : "—"} → {r.current ? pct(r.current.successRate) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right"><DeltaLabel value={r.deltaSuccessRate} kind="positive-good" /></td>
                    <td className="py-1.5 px-2 text-right">
                      {r.baseline ? sec(r.baseline.p95) : "—"} → {r.current ? sec(r.current.p95) : "—"}
                    </td>
                    <td className={`py-1.5 px-2 text-right ${r.deltaP95 < 0 ? "text-success" : r.deltaP95 > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {r.deltaP95 >= 0 ? "+" : ""}{r.deltaP95.toFixed(1)}s
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {r.baseline ? pct(r.baseline.dlqRate) : "—"} → {r.current ? pct(r.current.dlqRate) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right"><DeltaLabel value={r.deltaDlqRate} kind="positive-bad" /></td>
                    <td className="py-1.5 pl-2">
                      <Badge variant="outline" className={`text-[10px] ${classBadge[r.classification].className}`}>
                        {classBadge[r.classification].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResilienceReport;
