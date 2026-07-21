import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Advisory {
  id: string;
  created_at: string;
  current_policy: { maxAttempts: number; baseDelaySecs: number; maxDelaySecs: number; jitterPct: number };
  candidate_policy: { maxAttempts: number; baseDelaySecs: number; maxDelaySecs: number; jitterPct: number };
  observed_success_rate: number;
  candidate_success_rate: number;
  improvement_pp: number;
  confidence: number;
  sample_size: number;
  applied_at: string | null;
  dismissed_at: string | null;
}

function fmtPolicy(p: Advisory["current_policy"]) {
  return `${p.maxAttempts}× · base ${p.baseDelaySecs}s · max ${p.maxDelaySecs}s · jitter ${(p.jitterPct * 100).toFixed(0)}%`;
}

export function RetryPolicyAdvisoriesPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["retry-policy-advisories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retry_policy_advisories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Advisory[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "apply" | "dismiss" }) => {
      const patch = action === "apply"
        ? { applied_at: new Date().toISOString() }
        : { dismissed_at: new Date().toISOString() };
      const { error } = await supabase.from("retry_policy_advisories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["retry-policy-advisories"] });
      toast({
        title: vars.action === "apply" ? "Recomendação marcada como aplicada" : "Recomendação dispensada",
        description: vars.action === "apply"
          ? "Ajuste a política default no código e faça deploy do worker."
          : "A recomendação foi arquivada.",
      });
    },
  });

  const pending = (data ?? []).filter((a) => !a.applied_at && !a.dismissed_at);
  const history = (data ?? []).filter((a) => a.applied_at || a.dismissed_at);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Tuner de Política de Retry
          </CardTitle>
          <CardDescription>
            Diariamente o sistema roda uma mini-simulação Monte Carlo com base nas falhas reais das últimas 24h.
            Quando um ajuste de política tem ganho estatisticamente significativo, ele aparece aqui para revisão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && pending.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Nenhuma recomendação pendente — a política atual está bem calibrada.
            </div>
          )}
          {pending.map((a) => (
            <div key={a.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    Ganho estimado: <span className="text-primary">+{(a.improvement_pp * 100).toFixed(2)}pp</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      (confiança {(a.confidence * 100).toFixed(1)}%, amostra {a.sample_size})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criada {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
                <Badge variant="outline" className="border-primary text-primary">
                  {(a.candidate_success_rate * 100).toFixed(1)}% vs. {(a.observed_success_rate * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="grid gap-2 text-xs font-mono">
                <div><span className="text-muted-foreground">Atual:    </span>{fmtPolicy(a.current_policy)}</div>
                <div><span className="text-muted-foreground">Sugerida: </span>{fmtPolicy(a.candidate_policy)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide.mutate({ id: a.id, action: "apply" })} disabled={decide.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Marcar como aplicada
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, action: "dismiss" })} disabled={decide.isPending}>
                  <XCircle className="h-4 w-4 mr-1.5" /> Dispensar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0">
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })} · +{(a.improvement_pp * 100).toFixed(2)}pp
                </span>
                <Badge variant={a.applied_at ? "default" : "outline"} className="text-[10px]">
                  {a.applied_at ? "aplicada" : "dispensada"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
