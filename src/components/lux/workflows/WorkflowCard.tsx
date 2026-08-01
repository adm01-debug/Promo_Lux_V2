import { Play, Pause, Trash2, Loader2, ArrowRight, Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Workflow } from "@/lib/api/workflows";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Ativo", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  draft: { label: "Rascunho", color: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30", icon: null },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: null },
  running: { label: "Executando", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
};

const stepIcons: Record<string, React.ReactNode> = {
  source: <Globe className="h-3.5 w-3.5" />,
  enrich: <Globe className="h-3.5 w-3.5" />,
  filter: <Globe className="h-3.5 w-3.5" />,
  action: <Globe className="h-3.5 w-3.5" />,
};

const stepColors: Record<string, string> = {
  source: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enrich: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  filter: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  action: "bg-green-500/20 text-green-400 border-green-500/30",
};

interface WorkflowCardProps {
  workflow: Workflow;
  index: number;
  isExpanded: boolean;
  isRunning: boolean;
  onToggleExpand: () => void;
  onRun: (id: string) => void;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  canDelete?: boolean;
  canEdit?: boolean;
}

const defaultSteps = [
  { id: "s1", type: "source" as const, label: "Google Maps Scraper", provider: "gmaps.atomicabr" },
  { id: "s2", type: "enrich" as const, label: "Importar & Enriquecer", provider: "Waterfall" },
  { id: "s3", type: "filter" as const, label: "Scoring IPC", provider: "LUX IA" },
  { id: "s4", type: "action" as const, label: "Salvar no Banco", provider: "Lovable Cloud" },
];

export const WorkflowCard = ({ workflow: wf, index, isExpanded, isRunning, onToggleExpand, onRun, onToggleStatus, onDelete, canDelete = true, canEdit = true }: WorkflowCardProps) => {
  const config = statusConfig[wf.status] || statusConfig.draft;
  const steps = (wf.steps || defaultSteps) as typeof defaultSteps;
  const lastRun = wf.workflow_runs?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)] hover:border-primary/20 border border-transparent"
    >
      <button
        className="w-full p-5 text-left flex items-center justify-between hover:bg-primary/5 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {steps.map((step, si) => (
              <div key={step.id} className="flex items-center gap-1">
                <div className={cn("h-7 w-7 rounded-md flex items-center justify-center border", stepColors[step.type])}>
                  {stepIcons[step.type] || <Globe className="h-3.5 w-3.5" />}
                </div>
                {si < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
              </div>
            ))}
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{wf.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant="outline" className={`text-xs ${config.color} gap-1`}>
            {config.icon} {config.label}
          </Badge>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 p-5 space-y-4">
              {/* Visual pipeline */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {steps.map((step, si) => (
                  <motion.div key={step.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: si * 0.08 }} className="flex items-center gap-3">
                    <div className={cn("rounded-lg border p-3 min-w-[140px]", stepColors[step.type])}>
                      <div className="flex items-center gap-2 mb-1">
                        {stepIcons[step.type] || <Globe className="h-3.5 w-3.5" />}
                        <span className="text-xs font-medium">{step.label}</span>
                      </div>
                      {step.provider && <p className="text-[10px] opacity-70">{step.provider}</p>}
                    </div>
                    {si < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <div><span className="text-muted-foreground">Processados:</span><span className="ml-2 font-mono font-bold text-foreground">{(wf.leads_processed || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Qualificados:</span><span className="ml-2 font-mono font-bold text-success">{(wf.leads_qualified || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Taxa:</span><span className="ml-2 font-mono font-bold text-primary">{wf.success_rate || 0}%</span></div>
                <div><span className="text-muted-foreground">Último run:</span><span className="ml-2 text-foreground">{wf.last_run_at ? new Date(wf.last_run_at).toLocaleString("pt-BR") : "Nunca"}</span></div>
              </div>

              {/* Last run results */}
              {lastRun?.results && Object.keys(lastRun.results).length > 0 && (
                <div className="glass rounded-lg p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Último resultado</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {lastRun.results.scrape && <div><span className="text-muted-foreground">Scrape:</span><span className="ml-1 text-foreground font-medium">{lastRun.results.scrape.status || "—"}</span></div>}
                    {lastRun.results.enrich && <div><span className="text-muted-foreground">Importados:</span><span className="ml-1 text-foreground font-medium">{lastRun.results.enrich.companies_imported ?? "—"}</span></div>}
                    {lastRun.results.ipc_score && <div><span className="text-muted-foreground">Scored:</span><span className="ml-1 text-foreground font-medium">{lastRun.results.ipc_score.companies_scored ?? "—"}</span></div>}
                    {lastRun.results.summary && <div><span className="text-muted-foreground">Qualificados:</span><span className="ml-1 text-success font-bold">{lastRun.results.summary.qualified ?? "—"}</span></div>}
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {(wf.success_rate || 0) > 0 && (
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${wf.success_rate}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {canEdit && (
                  <Button size="sm" className="gap-1.5 text-xs" disabled={isRunning} onClick={(e) => { e.stopPropagation(); onRun(wf.id); }}>
                    {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {isRunning ? "Executando..." : "Executar Agora"}
                  </Button>
                )}
                {canEdit && wf.status === "active" ? (
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); onToggleStatus(wf.id, "paused"); }}>
                    <Pause className="h-3 w-3" /> Pausar
                  </Button>
                ) : canEdit && wf.status === "paused" ? (
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); onToggleStatus(wf.id, "active"); }}>
                    <Play className="h-3 w-3" /> Ativar
                  </Button>
                ) : null}
                {canDelete && (
                  <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(wf.id); }}>
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
