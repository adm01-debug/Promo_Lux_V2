import { Play, Pause, RotateCcw, Clock, CheckCircle2, AlertCircle, Workflow, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_WORKFLOWS } from "@/lib/demoData";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; glow: string }> = {
  running: { label: "Executando", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" />, glow: "shadow-[0_0_12px_hsl(var(--success)/0.2)]" },
  active: { label: "Ativo", color: "bg-success/20 text-success border-success/30", icon: <Zap className="h-3 w-3" />, glow: "shadow-[0_0_12px_hsl(var(--success)/0.2)]" },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" />, glow: "" },
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground border-border", icon: <Pause className="h-3 w-3" />, glow: "" },
  completed: { label: "Concluído", color: "bg-primary/20 text-primary border-primary/30", icon: <CheckCircle2 className="h-3 w-3" />, glow: "shadow-[0_0_12px_hsl(var(--primary)/0.15)]" },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" />, glow: "" },
};

/* Mini circular progress ring */
const ProgressRing = ({ value, size = 28, stroke = 2.5 }: { value: number; size?: number; stroke?: number }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
};

export const AutomationsList = () => {
  const { isDemoMode } = useDemo();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["dashboard-workflows", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) return DEMO_WORKFLOWS;
      const { data, error } = await db
        .from("workflows")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; name: string; status: string; success_rate: number | null;
        last_run_at: string | null; leads_processed: number | null;
        leads_qualified: number | null; description: string | null;
        config: unknown; steps: unknown; created_at: string; updated_at: string; user_id: string;
      }>;
    },
    staleTime: isDemoMode ? Infinity : 15_000,
  });

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Automações</h2>
              <p className="text-xs text-muted-foreground">Workflows ativos e raspagens</p>
            </div>
          </div>
          <Button size="sm" className="gap-2 text-xs h-8">
            <Play className="h-3.5 w-3.5" />
            Nova
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
        <div className="divide-y divide-border/20">
          {workflows.map((wf, i) => {
            const config = statusConfig[wf.status] ?? statusConfig.draft;
            const progress = wf.success_rate ?? 0;
            const isRunning = wf.status === "running" || wf.status === "active";

            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                whileHover={{ backgroundColor: "hsl(var(--secondary) / 0.3)", x: 2 }}
                className={cn(
                  "p-4 transition-all cursor-pointer group",
                  isRunning && config.glow
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {/* Progress ring */}
                    <div className="relative">
                      <ProgressRing value={progress} />
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-muted-foreground">
                        {progress}
                      </span>
                    </div>

                    <div>
                      <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {wf.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] py-0 ${config.color} gap-1`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                        {isRunning && (
                          <motion.div
                            className="h-1.5 w-1.5 rounded-full bg-success"
                            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground ml-10">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {wf.last_run_at
                      ? formatDistanceToNow(new Date(wf.last_run_at), { addSuffix: true, locale: ptBR })
                      : "Nunca executado"}
                  </span>
                  <span className="font-mono">{wf.leads_processed ?? 0} leads</span>
                  <span className="font-mono text-success">{wf.leads_qualified ?? 0} qualif.</span>
                </div>

                {isRunning && (
                  <div className="mt-2.5 ml-10 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-success rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
