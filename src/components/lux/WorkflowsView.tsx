import { useState } from "react";
import {
  Play, Pause, Plus, Clock, CheckCircle2, AlertCircle, ArrowRight, Globe, Linkedin,
  Database, Mail, Filter, RotateCcw, Settings, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    description: "Baseado em PhantomBuster: extrai perfis do LinkedIn, enriquece com dados de contato e sincroniza com o CRM",
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
  },
  {
    id: "2",
    name: "Google Maps → Waterfall Enrichment",
    description: "Inspirado em Clay: busca empresas no Google Maps e aplica enriquecimento em cascata com múltiplos provedores",
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
  },
  {
    id: "3",
    name: "Monitoramento Contínuo IPC",
    description: "Inspirado em Lusha Auto-Search: monitora novos matches do IPC automaticamente e os exporta",
    status: "paused",
    steps: [
      { id: "s1", type: "source", label: "IPC Monitor", icon: <Filter className="h-3.5 w-3.5" />, provider: "Lusha-style" },
      { id: "s2", type: "enrich", label: "Dados CNPJ", icon: <Database className="h-3.5 w-3.5" /> },
      { id: "s3", type: "action", label: "Auto Export", icon: <Database className="h-3.5 w-3.5" /> },
    ],
    leadsProcessed: 0,
    leadsQualified: 0,
    lastRun: "Nunca",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflows de Automação</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pipelines visuais inspirados em Clay, PhantomBuster e Lusha
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Workflow
        </Button>
      </div>

      <div className="space-y-4">
        {mockWorkflows.map((wf) => {
          const config = statusConfig[wf.status];
          const isExpanded = expandedId === wf.id;

          return (
            <div key={wf.id} className="glass rounded-lg overflow-hidden">
              <button
                className="w-full p-5 text-left flex items-center justify-between hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : wf.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-1">
                        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center border", stepColors[step.type])}>
                          {step.icon}
                        </div>
                        {i < wf.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{wf.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`text-xs ${config.color} gap-1`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 p-5 space-y-4">
                  {/* Visual pipeline */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <div className={cn("rounded-lg border p-3 min-w-[140px]", stepColors[step.type])}>
                          <div className="flex items-center gap-2 mb-1">
                            {step.icon}
                            <span className="text-xs font-medium">{step.label}</span>
                          </div>
                          {step.provider && (
                            <p className="text-[10px] opacity-70">{step.provider}</p>
                          )}
                        </div>
                        {i < wf.steps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
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

                  <div className="flex gap-2">
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
