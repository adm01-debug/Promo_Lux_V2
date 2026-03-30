import { Play, Pause, RotateCcw, Clock, CheckCircle2, AlertCircle, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AutomationStatus = "running" | "paused" | "active" | "completed" | "error" | "draft";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  running: { label: "Executando", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  active: { label: "Ativo", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground border-border", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Concluído", color: "bg-primary/20 text-primary border-primary/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
};

export const AutomationsList = () => {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ["dashboard-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Automações</h2>
            <p className="text-sm text-muted-foreground">Gerencie suas raspagens e buscas</p>
          </div>
          <Button size="sm" className="gap-2">
            <Play className="h-3.5 w-3.5" />
            Nova Automação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : !workflows || workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhuma automação"
          description="Crie seu primeiro workflow para começar a automatizar a prospecção."
          actionLabel="Criar Workflow"
        />
      ) : (
        <div className="divide-y divide-border/30">
          {workflows.map((wf) => {
            const config = statusConfig[wf.status] ?? statusConfig.draft;
            const progress = wf.success_rate ?? 0;
            return (
              <div key={wf.id} className="p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-foreground">{wf.name}</span>
                    <Badge variant="outline" className={`text-xs ${config.color} gap-1`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      {wf.status === "running" || wf.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {wf.last_run_at
                      ? formatDistanceToNow(new Date(wf.last_run_at), { addSuffix: true, locale: ptBR })
                      : "Nunca executado"}
                  </span>
                  <span>{wf.leads_processed ?? 0} empresas</span>
                  <span>{progress}%</span>
                </div>
                {(wf.status === "running" || wf.status === "active") && (
                  <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
