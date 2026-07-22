import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, CheckCircle2, XCircle, ShieldCheck, Undo2, Globe, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface PolicyShape {
  maxAttempts: number;
  baseDelaySecs: number;
  maxDelaySecs: number;
  jitterPct: number;
}

interface Advisory {
  id: string;
  created_at: string;
  organization_id: string | null;
  current_policy: PolicyShape;
  candidate_policy: PolicyShape;
  previous_policy: PolicyShape | null;
  observed_success_rate: number;
  candidate_success_rate: number;
  improvement_pp: number;
  confidence: number;
  sample_size: number;
  applied_at: string | null;
  applied_scope: "org" | "global" | null;
  dismissed_at: string | null;
  rolled_back_at: string | null;
}

function fmtPolicy(p: PolicyShape | null) {
  if (!p) return "—";
  return `${p.maxAttempts}× · base ${p.baseDelaySecs}s · max ${p.maxDelaySecs}s · jitter ${(p.jitterPct * 100).toFixed(0)}%`;
}

export function RetryPolicyAdvisoriesPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["retry-policy-advisories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retry_policy_advisories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Advisory[];
    },
  });

  const apply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("apply_retry_advisory", { _advisory_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retry-policy-advisories"] });
      toast({
        title: "Política aplicada",
        description: "A recomendação foi ativada para a organização. Você pode reverter a qualquer momento.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Falha ao aplicar", description: err.message, variant: "destructive" }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retry_policy_advisories")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retry-policy-advisories"] });
      toast({ title: "Recomendação dispensada" });
    },
    onError: (err: Error) =>
      toast({ title: "Falha ao dispensar", description: err.message, variant: "destructive" }),
  });

  const rollback = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rollback_retry_advisory", { _advisory_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retry-policy-advisories"] });
      toast({
        title: "Rollback executado",
        description: "A política anterior foi restaurada para a organização.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Falha ao reverter", description: err.message, variant: "destructive" }),
  });

  const list = data ?? [];
  const pending = list.filter((a) => !a.applied_at && !a.dismissed_at);
  const applied = list.filter((a) => a.applied_at && !a.rolled_back_at && a.applied_scope === "org");
  const history = list.filter((a) => a.dismissed_at || a.rolled_back_at || (a.applied_at && a.applied_scope !== "org"));

  const busy = apply.isPending || dismiss.isPending || rollback.isPending;

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Tuner de Política de Retry
          </CardTitle>
          <CardDescription>
            Recomendações passam por aprovação manual. Ao aplicar, a política ativa da organização é atualizada
            e a política anterior fica guardada para rollback com um clique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                    {a.organization_id === null && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-500">
                        <Globe className="h-3 w-3" /> escopo global
                      </span>
                    )}
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
                <AlertDialog open={pendingId === a.id} onOpenChange={(o) => setPendingId(o ? a.id : null)}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={busy}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar e aplicar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aplicar nova política de retry?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>A política ativa da organização será substituída pela recomendação.</p>
                          <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                            <div>De:   {fmtPolicy(a.current_policy)}</div>
                            <div>Para: {fmtPolicy(a.candidate_policy)}</div>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            A política anterior é preservada — você pode reverter na aba "Aplicadas" a qualquer momento.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          apply.mutate(a.id);
                          setPendingId(null);
                        }}
                      >
                        Confirmar aplicação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" variant="outline" onClick={() => dismiss.mutate(a.id)} disabled={busy}>
                  <XCircle className="h-4 w-4 mr-1.5" /> Dispensar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {applied.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aplicadas (reversíveis)
            </CardTitle>
            <CardDescription>Políticas ativas com rollback disponível para a política anterior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {applied.map((a) => (
              <div
                key={a.id}
                className="rounded-md border border-border/50 p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="text-xs space-y-1 font-mono">
                  <div className="text-muted-foreground text-[11px]">
                    Aplicada {a.applied_at && formatDistanceToNow(new Date(a.applied_at), { locale: ptBR, addSuffix: true })}
                  </div>
                  <div>Ativa: {fmtPolicy(a.candidate_policy)}</div>
                  <div className="text-muted-foreground">Anterior: {fmtPolicy(a.previous_policy)}</div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={busy || !a.previous_policy}>
                      <Undo2 className="h-4 w-4 mr-1.5" /> Rollback
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reverter para a política anterior?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>A política ativa voltará imediatamente para o valor anterior:</p>
                          <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                            <div>De:   {fmtPolicy(a.candidate_policy)}</div>
                            <div>Para: {fmtPolicy(a.previous_policy)}</div>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => rollback.mutate(a.id)}>
                        Confirmar rollback
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((a) => {
              const status = a.rolled_back_at
                ? { label: "revertida", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" }
                : a.dismissed_at
                ? { label: "dispensada", cls: "bg-muted text-muted-foreground border-border/40" }
                : { label: "aplicada (global)", cls: "bg-primary/15 text-primary border-primary/30" };
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0"
                >
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })} ·
                    +{(a.improvement_pp * 100).toFixed(2)}pp
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${status.cls}`}>
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
