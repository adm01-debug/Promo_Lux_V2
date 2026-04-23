import { useState } from "react";
import { Shield, Play, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

/**
 * Painel administrativo: dispara a edge function `rls-tests` que provisiona
 * usuários e organizações temporárias e valida o isolamento RLS multi-tenant.
 * Resultado é exibido em tempo real para auditoria.
 */
export const RLSVerificationPanel = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ApiResponse | null>(null);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Falha ao executar verificação", description: message });
    } finally {
      setLoading(false);
    }
  };

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
          </div>

          <ScrollArea className="h-72 rounded-md border border-border/50 bg-background/40">
            <ul className="divide-y divide-border/40">
              {report.results.map((r) => (
                <li key={r.name} className="px-3 py-2 flex items-start gap-2 text-xs">
                  {r.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-foreground truncate">{r.name}</p>
                    <p className="text-muted-foreground text-[11px] truncate">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
