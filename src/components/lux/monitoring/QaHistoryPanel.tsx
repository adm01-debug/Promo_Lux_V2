import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type QaKind = "all" | "unit" | "edge" | "e2e" | "integration" | "lint" | "typecheck";

interface QaRun {
  id: string;
  round: number | null;
  kind: string;
  suite: string | null;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  duration_ms: number;
  coverage_pct: number | null;
  commit_sha: string | null;
  branch: string | null;
  created_at: string;
}

const KINDS: { value: QaKind; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "unit", label: "Unit" },
  { value: "edge", label: "Edge" },
  { value: "e2e", label: "E2E" },
  { value: "integration", label: "Integração" },
  { value: "lint", label: "Lint" },
  { value: "typecheck", label: "Typecheck" },
];

const fmtDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
};

const passRate = (r: QaRun) =>
  r.tests_total === 0 ? 0 : (r.tests_passed / r.tests_total) * 100;

export const QaHistoryPanel = memo(() => {
  const [kind, setKind] = useState<QaKind>("all");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["qa-test-runs", kind],
    queryFn: async () => {
      let q = supabase
        .from("qa_test_runs")
        .select(
          "id,round,kind,suite,tests_total,tests_passed,tests_failed,tests_skipped,duration_ms,coverage_pct,commit_sha,branch,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (kind !== "all") q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as QaRun[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    if (!runs.length) {
      return {
        total: 0,
        passRate: 0,
        failed: 0,
        avgDuration: 0,
        avgCoverage: null as number | null,
        lastRun: null as QaRun | null,
      };
    }
    const totalTests = runs.reduce((s, r) => s + r.tests_total, 0);
    const passed = runs.reduce((s, r) => s + r.tests_passed, 0);
    const failed = runs.reduce((s, r) => s + r.tests_failed, 0);
    const totalDur = runs.reduce((s, r) => s + r.duration_ms, 0);
    const cov = runs.filter((r) => r.coverage_pct !== null);
    return {
      total: totalTests,
      passRate: totalTests ? (passed / totalTests) * 100 : 0,
      failed,
      avgDuration: totalDur / runs.length,
      avgCoverage:
        cov.length > 0
          ? cov.reduce((s, r) => s + (r.coverage_pct ?? 0), 0) / cov.length
          : null,
      lastRun: runs[0],
    };
  }, [runs]);

  const chartData = useMemo(() => {
    return [...runs]
      .reverse()
      .slice(-40)
      .map((r) => ({
        round: r.round ?? "-",
        when: format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR }),
        passRate: Number(passRate(r).toFixed(1)),
        failed: r.tests_failed,
        durationSec: Number((r.duration_ms / 1000).toFixed(1)),
        coverage: r.coverage_pct != null ? Number(r.coverage_pct) : null,
        kind: r.kind,
      }));
  }, [runs]);

  const byKind = useMemo(() => {
    const acc = new Map<string, { total: number; passed: number; failed: number; runs: number }>();
    for (const r of runs) {
      const prev = acc.get(r.kind) ?? { total: 0, passed: 0, failed: 0, runs: 0 };
      prev.total += r.tests_total;
      prev.passed += r.tests_passed;
      prev.failed += r.tests_failed;
      prev.runs += 1;
      acc.set(r.kind, prev);
    }
    return Array.from(acc.entries()).map(([k, v]) => ({
      kind: k,
      failRate: v.total ? Number(((v.failed / v.total) * 100).toFixed(2)) : 0,
      runs: v.runs,
      failed: v.failed,
    }));
  }, [runs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Histórico de QA</h2>
          <p className="text-sm text-muted-foreground">
            Cobertura, tempo de execução e taxa de falha por rodada — unit, edge e E2E.
          </p>
        </div>
        <Tabs value={kind} onValueChange={(v) => setKind(v as QaKind)}>
          <TabsList>
            {KINDS.map((k) => (
              <TabsTrigger key={k.value} value={k.value}>
                {k.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          label="Taxa de aprovação"
          value={`${stats.passRate.toFixed(1)}%`}
          hint={`${stats.total.toLocaleString("pt-BR")} testes agregados`}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          label="Falhas acumuladas"
          value={stats.failed.toLocaleString("pt-BR")}
          hint={`${runs.length} rodadas visíveis`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-primary" />}
          label="Duração média"
          value={runs.length ? fmtDuration(Math.round(stats.avgDuration)) : "-"}
          hint="Média por rodada"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          label="Cobertura média"
          value={stats.avgCoverage != null ? `${stats.avgCoverage.toFixed(1)}%` : "n/d"}
          hint={stats.avgCoverage != null ? "Rodadas com coverage reportado" : "Reporte coverage_pct no CI"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Evolução por rodada
            </CardTitle>
            <CardDescription>Taxa de aprovação e cobertura ao longo do tempo (últimas 40).</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : chartData.length === 0 ? (
              <EmptyHint />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="when" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="l" type="monotone" dataKey="passRate" name="Pass rate %" stroke="hsl(var(--primary))" dot={false} />
                  <Line yAxisId="l" type="monotone" dataKey="coverage" name="Coverage %" stroke="hsl(var(--success))" dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="durationSec" name="Duração (s)" stroke="hsl(var(--muted-foreground))" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Taxa de falha por tipo
            </CardTitle>
            <CardDescription>Onde estão as regressões concentradas.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : byKind.length === 0 ? (
              <EmptyHint />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byKind}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="kind" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="failRate" name="Falha %" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rodadas recentes</CardTitle>
          <CardDescription>Últimas execuções gravadas por CI ou manualmente.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : runs.length === 0 ? (
            <EmptyHint />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Rodada</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Suite</TableHead>
                    <TableHead className="text-right">Testes</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead className="text-right">Pass %</TableHead>
                    <TableHead className="text-right">Cobertura</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead>Commit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.slice(0, 50).map((r) => {
                    const rate = passRate(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs">{r.round ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {r.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {r.suite ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{r.tests_total}</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${r.tests_failed > 0 ? "text-destructive" : ""}`}>
                          {r.tests_failed}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          <span className={rate >= 99 ? "text-success" : rate >= 90 ? "text-warning" : "text-destructive"}>
                            {rate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {r.coverage_pct != null ? `${r.coverage_pct}%` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtDuration(r.duration_ms)}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {r.commit_sha ? r.commit_sha.slice(0, 7) : "-"}
                          {r.branch ? <span className="ml-1 opacity-60">({r.branch})</span> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

QaHistoryPanel.displayName = "QaHistoryPanel";

const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
      </CardContent>
    </Card>
  );
});

const EmptyHint = memo(function EmptyHint() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 py-6">
      <p className="text-sm font-medium">Sem rodadas registradas ainda.</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md">
        Envie do CI um POST para <code className="font-mono">/functions/v1/qa-ingest-run</code> com header{" "}
        <code className="font-mono">x-qa-token</code>. O painel atualiza automaticamente.
      </p>
    </div>
  );
});
