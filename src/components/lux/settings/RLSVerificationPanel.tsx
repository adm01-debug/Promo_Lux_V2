import { useEffect, useMemo, useState, useCallback } from "react";
import { Shield, Play, CheckCircle2, XCircle, Loader2, AlertTriangle, History, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { exportReportCSV, exportReportPDF, exportHistoryCSV, exportHistoryEntryPDF } from "@/lib/exportRLSReport";

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}
interface ApiResponse {
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

interface HistoryEntry {
  id: string;
  created_at: string;
  all_passed: boolean;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  failed_results: TestResult[];
  passed_names: string[];
}

type RuleOp = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "COVERAGE" | "SETUP";

interface ParsedTest extends TestResult {
  op: RuleOp;
  table: string | null;
  description: string;
}

const OP_STYLES: Record<RuleOp, string> = {
  SELECT:   "bg-sky-500/15 text-sky-300 border-sky-500/30",
  INSERT:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  UPDATE:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DELETE:   "bg-rose-500/15 text-rose-300 border-rose-500/30",
  COVERAGE: "bg-primary/15 text-primary border-primary/30",
  SETUP:    "bg-muted text-muted-foreground border-border",
};

/** Parses a raw test name (e.g. `orgA_member_cannot_update_orgB_company`)
 *  into its operation type, target table and a human-friendly description. */
function parseTest(t: TestResult): ParsedTest {
  const n = t.name;
  const make = (op: RuleOp, table: string | null, description: string): ParsedTest =>
    ({ ...t, op, table, description });

  if (n === "rls_coverage_complete") {
    return make("COVERAGE", null, t.passed
      ? "Todas as tabelas RLS estão cobertas pelo registry."
      : "Há tabelas RLS sem cobertura no registry compartilhado.");
  }
  if (n === "SETUP_ERROR") return make("SETUP", null, "Falha ao preparar ambiente de teste.");

  // anon_cannot_read_<table> / anon_cannot_insert_<table>
  const anonRead = n.match(/^anon_cannot_read_(.+)$/);
  if (anonRead) return make("SELECT", anonRead[1],
    `Usuário anônimo NÃO deve conseguir ler "${anonRead[1]}".`);
  const anonInsert = n.match(/^anon_cannot_insert_(.+)$/);
  if (anonInsert) return make("INSERT", anonInsert[1],
    `Usuário anônimo NÃO deve conseguir inserir em "${anonInsert[1]}".`);

  // userB_cannot_(see|update|delete)_userA_<table>
  const ub = n.match(/^userB_cannot_(see|update|delete)_userA_(.+)$/);
  if (ub) {
    const opMap: Record<string, RuleOp> = { see: "SELECT", update: "UPDATE", delete: "DELETE" };
    const verb = { see: "ler", update: "alterar", delete: "remover" }[ub[1]];
    return make(opMap[ub[1]], ub[2], `Usuário B NÃO deve ${verb} ${ub[2]} de outro usuário.`);
  }
  if (n === "userA_can_see_own_company") {
    return make("SELECT", "companies", "Usuário A DEVE conseguir ler sua própria empresa.");
  }
  if (n === "userB_sees_only_own_profile") {
    return make("SELECT", "profiles", "Usuário B só pode enxergar o próprio profile.");
  }

  // orgA_member_cannot_(read|update|delete|insert_into)_orgB(_<table>)?
  const org = n.match(/^orgA_member_cannot_(read|update|delete)_orgB_(.+)$/);
  if (org) {
    const opMap: Record<string, RuleOp> = { read: "SELECT", update: "UPDATE", delete: "DELETE" };
    const verb = { read: "ler", update: "alterar", delete: "remover" }[org[1]];
    return make(opMap[org[1]], org[2], `Membro da org A NÃO deve ${verb} ${org[2]} da org B.`);
  }
  if (n === "orgA_member_cannot_insert_into_orgB") {
    return make("INSERT", "companies",
      "Membro da org A NÃO deve inserir empresa apontando para org B.");
  }
  if (n === "orgB_member_cannot_read_orgA_company") {
    return make("SELECT", "companies", "Membro da org B NÃO deve ler empresa da org A.");
  }

  return make("SETUP", null, t.name);
}

/**
 * Painel administrativo: dispara a edge function `rls-tests` que provisiona
 * usuários e organizações temporárias e valida o isolamento RLS multi-tenant.
 * Resultado é exibido em tempo real e gravado em `audit_logs` para histórico.
 */
export const RLSVerificationPanel = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ApiResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<"failed" | "all">("failed");
  const [historyStatus, setHistoryStatus] = useState<"all" | "pass" | "fail">("all");
  const [historyPeriod, setHistoryPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  const loadHistory = useCallback(async () => {
    const hours = historyPeriod === "24h" ? 24 : historyPeriod === "7d" ? 24 * 7 : 24 * 30;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("audit_logs")
      .select("id, created_at, new_data")
      .eq("table_name", "__rls_verification")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    const mapped = data.map((row) => {
        const d = (row.new_data ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          created_at: row.created_at,
          all_passed: Boolean(d.all_passed),
          total: Number(d.total ?? 0),
          passed: Number(d.passed ?? 0),
          failed: Number(d.failed ?? 0),
          duration_ms: Number(d.duration_ms ?? 0),
          failed_results: Array.isArray(d.failed_results) ? (d.failed_results as TestResult[]) : [],
          passed_names: Array.isArray(d.passed_names) ? (d.passed_names as string[]) : [],
        };
      });
    const filtered = mapped.filter((h) =>
      historyStatus === "all"
        ? true
        : historyStatus === "pass"
          ? h.all_passed
          : !h.all_passed,
    );
    setHistory(filtered);
  }, [historyPeriod, historyStatus]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const run = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke<ApiResponse>("rls-tests");
      if (error) throw error;
      setReport(data ?? null);
      if (data?.allPassed) {
        toast({ title: "✅ Isolamento RLS verificado", description: `${data.passed}/${data.total} testes passaram` });
      } else {
        toast({
          variant: "destructive",
          title: "⚠️ Falhas detectadas",
          description: `${data?.failed ?? "?"} de ${data?.total ?? "?"} testes falharam`,
        });
      }
      await loadHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Falha ao executar verificação", description: message });
    } finally {
      setLoading(false);
    }
  };

  const parsed = useMemo<ParsedTest[]>(
    () => (report?.results ?? []).map(parseTest),
    [report],
  );

  const opCounts = useMemo(() => {
    const acc: Record<RuleOp, { passed: number; failed: number }> = {
      SELECT: { passed: 0, failed: 0 },
      INSERT: { passed: 0, failed: 0 },
      UPDATE: { passed: 0, failed: 0 },
      DELETE: { passed: 0, failed: 0 },
      COVERAGE: { passed: 0, failed: 0 },
      SETUP: { passed: 0, failed: 0 },
    };
    for (const p of parsed) acc[p.op][p.passed ? "passed" : "failed"]++;
    return acc;
  }, [parsed]);

  const visible = useMemo(
    () => (filter === "failed" ? parsed.filter((p) => !p.passed) : parsed),
    [parsed, filter],
  );

  return (
    <div className="glass rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Verificação de Isolamento (RLS)</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Provisiona usuários e organizações temporárias no backend e confirma que membros de uma
              workspace não conseguem ler nem modificar dados de outra.
            </p>
          </div>
        </div>
        <Button onClick={run} disabled={loading} size="sm" className="gap-2 shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {loading ? "Executando..." : "Executar"}
        </Button>
      </div>

      {report && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={report.allPassed ? "default" : "destructive"} className="gap-1.5">
              {report.allPassed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {report.allPassed ? "Todos passaram" : "Falhas detectadas"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {report.passed}/{report.total} OK · {report.failed} falhas
            </span>
            <div className="ml-auto flex items-center gap-1 rounded-md border border-border/50 bg-background/40 p-0.5">
              <button
                type="button"
                onClick={() => setFilter("failed")}
                className={`text-[11px] px-2 py-0.5 rounded ${filter === "failed" ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground"}`}
              >
                Apenas falhas
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`text-[11px] px-2 py-0.5 rounded ${filter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Todos
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => exportReportCSV(report)}
              >
                <Download className="h-3 w-3" /> CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => exportReportPDF(report)}
              >
                <FileText className="h-3 w-3" /> PDF
              </Button>
            </div>
          </div>

          {/* Per-operation summary */}
          <div className="flex flex-wrap gap-1.5">
            {(["SELECT", "INSERT", "UPDATE", "DELETE", "COVERAGE"] as RuleOp[]).map((op) => {
              const c = opCounts[op];
              if (c.passed + c.failed === 0) return null;
              return (
                <span
                  key={op}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${OP_STYLES[op]}`}
                >
                  {op}
                  <span className="font-mono opacity-70">
                    {c.passed}/{c.passed + c.failed}
                  </span>
                  {c.failed > 0 && <AlertTriangle className="h-3 w-3" />}
                </span>
              );
            })}
          </div>

          <ScrollArea className="h-72 rounded-md border border-border/50 bg-background/40">
            {visible.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                {filter === "failed"
                  ? "Nenhuma regra RLS falhou. ✨"
                  : "Nenhum resultado para exibir."}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {visible.map((r) => (
                  <li key={r.name} className="px-3 py-2.5 flex items-start gap-2.5 text-xs">
                    {r.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${OP_STYLES[r.op]}`}
                        >
                          {r.op}
                        </span>
                        {r.table && (
                          <span className="font-mono text-[11px] text-foreground/90">{r.table}</span>
                        )}
                      </div>
                      <p className="text-foreground/90 leading-snug">{r.description}</p>
                      <p className="text-muted-foreground text-[10px] font-mono leading-tight">
                        {r.name} · {r.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground flex-wrap">
          <History className="h-3.5 w-3.5" />
          <span>Histórico ({history.length})</span>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border/50 bg-background/40 p-0.5">
            {(["all", "pass", "fail"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setHistoryStatus(s)}
                className={`text-[11px] px-2 py-0.5 rounded ${
                  historyStatus === s
                    ? s === "fail"
                      ? "bg-destructive/20 text-destructive"
                      : s === "pass"
                        ? "bg-success/20 text-success"
                        : "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Todos" : s === "pass" ? "Pass" : "Fail"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/50 bg-background/40 p-0.5">
            {(["24h", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setHistoryPeriod(p)}
                className={`text-[11px] px-2 py-0.5 rounded ${
                  historyPeriod === p
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">
            Nenhuma execução encontrada para os filtros selecionados.
          </p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setSelected(h)}
                key={h.id}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-background/40 border border-border/30 text-xs hover:bg-background/70 hover:border-primary/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {h.all_passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="text-foreground truncate">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <span className="text-muted-foreground font-mono shrink-0">
                  {h.passed}/{h.total} · {h.duration_ms}ms
                </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.all_passed ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              Execução RLS — {selected && new Date(selected.created_at).toLocaleString("pt-BR")}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {selected?.passed}/{selected?.total} passaram · {selected?.failed} falhas · {selected?.duration_ms}ms
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4">
                {selected.failed_results.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Falhas ({selected.failed_results.length})
                    </h4>
                    <ul className="divide-y divide-border/40 rounded-md border border-destructive/30 bg-destructive/5">
                      {selected.failed_results.map((r) => {
                        const p = parseTest(r);
                        return (
                          <li key={r.name} className="px-3 py-2.5 flex items-start gap-2.5 text-xs">
                            <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${OP_STYLES[p.op]}`}>
                                  {p.op}
                                </span>
                                {p.table && (
                                  <span className="font-mono text-[11px] text-foreground/90">{p.table}</span>
                                )}
                              </div>
                              <p className="text-foreground/90 leading-snug">{p.description}</p>
                              <p className="text-muted-foreground text-[10px] font-mono leading-tight break-all">
                                {r.name} · {r.detail}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {selected.passed_names.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-success flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Passaram ({selected.passed_names.length})
                    </h4>
                    <ul className="rounded-md border border-border/40 bg-background/40 divide-y divide-border/30">
                      {selected.passed_names.map((name) => {
                        const p = parseTest({ name, passed: true, detail: "" });
                        return (
                          <li key={name} className="px-3 py-2 flex items-center gap-2 text-[11px]">
                            <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${OP_STYLES[p.op]}`}>
                              {p.op}
                            </span>
                            {p.table && (
                              <span className="font-mono text-foreground/80">{p.table}</span>
                            )}
                            <span className="text-muted-foreground font-mono truncate">{name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {selected.failed_results.length === 0 && selected.passed_names.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Esta execução não armazenou detalhes de testes individuais.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
