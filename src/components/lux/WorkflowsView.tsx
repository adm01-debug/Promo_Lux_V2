import { useState } from "react";
import {
  Play, Pause, Plus, Clock, CheckCircle2, AlertCircle, ArrowRight, Globe, Linkedin,
  Database, Mail, Filter, RotateCcw, Settings, ChevronRight, Zap, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type WorkflowStatus = "active" | "paused" | "draft" | "error";

interface WorkflowStep {
  id: string;
  type: "source" | "enrich" | "filter" | "action";
  label: string;
  icon: React.ReactNode;
  provider?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  leadsProcessed: number;
  leadsQualified: number;
  lastRun: string;
  successRate: number;
}

const statusConfig: Record<WorkflowStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Ativo", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  draft: { label: "Rascunho", color: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30", icon: <Clock className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
};

const mockWorkflows: Workflow[] = [
  {
    id: "1",
    name: "Prospecção LinkedIn → Enriquecimento → CRM",
    description: "Extrai perfis do LinkedIn, enriquece com dados de contato e sincroniza com o CRM",
    status: "active",
    steps: [
      { id: "s1", type: "source", label: "LinkedIn Scraper", icon: <Linkedin className="h-3.5 w-3.5" />, provider: "PhantomBuster" },
      { id: "s2", type: "enrich", label: "Email Finder", icon: <Mail className="h-3.5 w-3.5" />, provider: "Hunter.io" },
      { id: "s3", type: "filter", label: "Filtro IPC", icon: <Filter className="h-3.5 w-3.5" /> },
      { id: "s4", type: "action", label: "Salvar DB", icon: <Database className="h-3.5 w-3.5" /> },
    ],
    leadsProcessed: 1243,
    leadsQualified: 892,
    lastRun: "Agora",
    successRate: 72,
  },
  {
    id: "2",
    name: "Google Maps → Waterfall Enrichment",
    description: "Busca empresas no Google Maps e aplica enriquecimento em cascata",
    status: "active",
    steps: [
      { id: "s1", type: "source", label: "Google Maps", icon: <Globe className="h-3.5 w-3.5" /> },
      { id: "s2", type: "enrich", label: "Waterfall (3 fontes)", icon: <Database className="h-3.5 w-3.5" />, provider: "Clay-style" },
      { id: "s3", type: "filter", label: "Score ≥ 70", icon: <Filter className="h-3.5 w-3.5" /> },
      { id: "s4", type: "action", label: "Notificar", icon: <Mail className="h-3.5 w-3.5" /> },
    ],
    leadsProcessed: 567,
    leadsQualified: 412,
    lastRun: "2h atrás",
    successRate: 73,
  },
  {
    id: "3",
    name: "Monitoramento Contínuo IPC",
    description: "Monitora novos matches do IPC automaticamente e os exporta",
    status: "paused",
    steps: [
      { id: "s1", type: "source", label: "IPC Monitor", icon: <Filter className="h-3.5 w-3.5" />, provider: "Lusha-style" },
      { id: "s2", type: "enrich", label: "Dados CNPJ", icon: <Database className="h-3.5 w-3.5" /> },
      { id: "s3", type: "action", label: "Auto Export", icon: <Database className="h-3.5 w-3.5" /> },
    ],
    leadsProcessed: 0,
    leadsQualified: 0,
    lastRun: "Nunca",
    successRate: 0,
  },
  {
    id: "4",
    name: "Scraper Multi-Fonte → Dedup → Score",
    description: "Combina dados de múltiplas fontes, remove duplicatas e pontua automaticamente",
    status: "draft",
    steps: [
      { id: "s1", type: "source", label: "Multi-Source", icon: <Globe className="h-3.5 w-3.5" /> },
      { id: "s2", type: "filter", label: "Dedup AI", icon: <Zap className="h-3.5 w-3.5" />, provider: "LUX IA" },
      { id: "s3", type: "enrich", label: "Auto Score", icon: <TrendingUp className="h-3.5 w-3.5" /> },
      { id: "s4", type: "action", label: "CRM Sync", icon: <Database className="h-3.5 w-3.5" /> },
    ],
    leadsProcessed: 0,
    leadsQualified: 0,
    lastRun: "Nunca",
    successRate: 0,
  },
];

const stepColors: Record<string, string> = {
  source: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enrich: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  filter: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  action: "bg-green-500/20 text-green-400 border-green-500/30",
};

export const WorkflowsView = () => {
  const [expandedId, setExpandedId] = useState<string | null>("1");

  const activeCount = mockWorkflows.filter(w => w.status === "active").length;
  const totalProcessed = mockWorkflows.reduce((a, w) => a + w.leadsProcessed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflows de Automação</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} ativos — {totalProcessed.toLocaleString()} leads processados
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Workflow
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ativos", value: activeCount, color: "text-success" },
          { label: "Total", value: mockWorkflows.length, color: "text-foreground" },
          { label: "Processados", value: totalProcessed.toLocaleString(), color: "text-primary" },
          { label: "Taxa Média", value: `${Math.round(mockWorkflows.filter(w => w.successRate > 0).reduce((a, w) => a + w.successRate, 0) / Math.max(mockWorkflows.filter(w => w.successRate > 0).length, 1))}%`, color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            <p className={`text-xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {mockWorkflows.map((wf, i) => {
          const config = statusConfig[wf.status];
          const isExpanded = expandedId === wf.id;

          return (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-lg overflow-hidden"
            >
              <button
                className="w-full p-5 text-left flex items-center justify-between hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : wf.id)}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    {wf.steps.map((step, si) => (
                      <div key={step.id} className="flex items-center gap-1">
                        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center border", stepColors[step.type])}>
                          {step.icon}
                        </div>
                        {si < wf.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
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
                    {config.icon}
                    {config.label}
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
                        {wf.steps.map((step, si) => (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: si * 0.08 }}
                            className="flex items-center gap-3"
                          >
                            <div className={cn("rounded-lg border p-3 min-w-[140px]", stepColors[step.type])}>
                              <div className="flex items-center gap-2 mb-1">
                                {step.icon}
                                <span className="text-xs font-medium">{step.label}</span>
                              </div>
                              {step.provider && <p className="text-[10px] opacity-70">{step.provider}</p>}
                            </div>
                            {si < wf.steps.length - 1 && (
                              <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                            )}
                          </motion.div>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm flex-wrap">
                        <div>
                          <span className="text-muted-foreground">Processados:</span>
                          <span className="ml-2 font-mono font-bold text-foreground">{wf.leadsProcessed.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Qualificados:</span>
                          <span className="ml-2 font-mono font-bold text-success">{wf.leadsQualified.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Taxa:</span>
                          <span className="ml-2 font-mono font-bold text-primary">
                            {wf.leadsProcessed > 0 ? Math.round((wf.leadsQualified / wf.leadsProcessed) * 100) : 0}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Último run:</span>
                          <span className="ml-2 text-foreground">{wf.lastRun}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {wf.successRate > 0 && (
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${wf.successRate}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                          />
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {wf.status === "active" ? (
                          <Button size="sm" variant="outline" className="gap-1 text-xs">
                            <Pause className="h-3 w-3" /> Pausar
                          </Button>
                        ) : (
                          <Button size="sm" className="gap-1 text-xs">
                            <Play className="h-3 w-3" /> Executar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <RotateCcw className="h-3 w-3" /> Re-executar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Settings className="h-3 w-3" /> Configurar
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
