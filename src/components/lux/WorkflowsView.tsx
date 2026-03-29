import { useState } from "react";
import { TableSkeleton } from "@/components/lux/ViewSkeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, Pause, Plus, Clock, CheckCircle2, AlertCircle, ArrowRight, Globe, Linkedin,
  Database, Mail, Filter, RotateCcw, Settings, ChevronRight, Zap, TrendingUp,
  Loader2, MapPin, Trash2, Radar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { workflowApi, type Workflow } from "@/lib/api/workflows";
import { toast } from "@/hooks/use-toast";

type WorkflowStatus = "active" | "paused" | "draft" | "error" | "running";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Ativo", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  draft: { label: "Rascunho", color: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30", icon: <Clock className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
  running: { label: "Executando", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
};

const stepIcons: Record<string, React.ReactNode> = {
  source: <Globe className="h-3.5 w-3.5" />,
  enrich: <Database className="h-3.5 w-3.5" />,
  filter: <Filter className="h-3.5 w-3.5" />,
  action: <Database className="h-3.5 w-3.5" />,
  gmaps: <MapPin className="h-3.5 w-3.5" />,
  ipc: <Radar className="h-3.5 w-3.5" />,
  score: <TrendingUp className="h-3.5 w-3.5" />,
};

const stepColors: Record<string, string> = {
  source: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enrich: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  filter: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  action: "bg-green-500/20 text-green-400 border-green-500/30",
};

const defaultSteps = [
  { id: "s1", type: "source" as const, label: "Google Maps Scraper", provider: "gmaps.atomicabr" },
  { id: "s2", type: "enrich" as const, label: "Importar & Enriquecer", provider: "Waterfall" },
  { id: "s3", type: "filter" as const, label: "Scoring IPC", provider: "LUX IA" },
  { id: "s4", type: "action" as const, label: "Salvar no Banco", provider: "Lovable Cloud" },
];

export const WorkflowsView = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("Google Maps → Enriquecimento → IPC");
  const [newDescription, setNewDescription] = useState("Raspa empresas, enriquece dados de contato e qualifica pelo IPC automaticamente");
  const [keywords, setKeywords] = useState("restaurantes, bares");
  const [radius, setRadius] = useState(10000);
  const [extractEmail, setExtractEmail] = useState(true);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: workflowApi.list,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: workflowApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow criado!", description: "Pipeline configurado com sucesso." });
      setCreateOpen(false);
    },
    onError: (err) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const runMutation = useMutation({
    mutationFn: workflowApi.run,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      const summary = result.results?.summary;
      toast({
        title: "Workflow executado!",
        description: summary
          ? `${summary.total_companies} empresas processadas, ${summary.qualified} qualificadas (${summary.success_rate}% taxa)`
          : "Pipeline concluído com sucesso.",
      });
    },
    onError: (err) => {
      toast({ title: "Erro ao executar", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => workflowApi.toggleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: workflowApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow removido" });
    },
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim(),
      steps: defaultSteps,
      config: {
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
        radius,
        email: extractEmail,
        depth: 1,
        lang: "pt",
      },
    });
  };

  const activeCount = workflows.filter(w => w.status === "active").length;
  const totalProcessed = workflows.reduce((a, w) => a + (w.leads_processed || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflows de Automação</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} ativos — {totalProcessed.toLocaleString()} leads processados
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Novo Workflow Automático
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Pipeline preview */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {defaultSteps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={cn("rounded-md border px-2 py-1.5 flex items-center gap-1.5 whitespace-nowrap", stepColors[step.type])}>
                      {stepIcons[step.type]}
                      <span className="text-[10px] font-medium">{step.label}</span>
                    </div>
                    {i < defaultSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Keywords (Google Maps)</Label>
                <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="restaurantes, bares, hotéis" className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Raio: {(radius / 1000).toFixed(0)}km</Label>
                <Slider value={[radius]} onValueChange={([v]) => setRadius(v)} min={1000} max={50000} step={1000} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Extrair emails</p>
                  <p className="text-[10px] text-muted-foreground">Busca emails nos sites encontrados</p>
                </div>
                <Switch checked={extractEmail} onCheckedChange={setExtractEmail} />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newName.trim()} className="w-full gap-2">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {createMutation.isPending ? "Criando..." : "Criar & Ativar Workflow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ativos", value: activeCount, color: "text-success" },
          { label: "Total", value: workflows.length, color: "text-foreground" },
          { label: "Processados", value: totalProcessed.toLocaleString(), color: "text-primary" },
          { label: "Taxa Média", value: `${Math.round(workflows.filter(w => (w.success_rate || 0) > 0).reduce((a, w) => a + (w.success_rate || 0), 0) / Math.max(workflows.filter(w => (w.success_rate || 0) > 0).length, 1))}%`, color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            <p className={`text-xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <TableSkeleton />
      ) : workflows.length === 0 ? (
        <div className="glass rounded-lg p-8 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-primary/30" />
          <p className="text-sm text-muted-foreground">Nenhum workflow criado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Crie um pipeline para automatizar raspagem → enriquecimento → IPC</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf, i) => {
            const config = statusConfig[wf.status] || statusConfig.draft;
            const isExpanded = expandedId === wf.id;
            const steps = (wf.steps || defaultSteps) as typeof defaultSteps;
            const lastRun = wf.workflow_runs?.[0];

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
                            <motion.div
                              key={step.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: si * 0.08 }}
                              className="flex items-center gap-3"
                            >
                              <div className={cn("rounded-lg border p-3 min-w-[140px]", stepColors[step.type])}>
                                <div className="flex items-center gap-2 mb-1">
                                  {stepIcons[step.type] || <Globe className="h-3.5 w-3.5" />}
                                  <span className="text-xs font-medium">{step.label}</span>
                                </div>
                                {step.provider && <p className="text-[10px] opacity-70">{step.provider}</p>}
                              </div>
                              {si < steps.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                              )}
                            </motion.div>
                          ))}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm flex-wrap">
                          <div>
                            <span className="text-muted-foreground">Processados:</span>
                            <span className="ml-2 font-mono font-bold text-foreground">{(wf.leads_processed || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Qualificados:</span>
                            <span className="ml-2 font-mono font-bold text-success">{(wf.leads_qualified || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Taxa:</span>
                            <span className="ml-2 font-mono font-bold text-primary">{wf.success_rate || 0}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Último run:</span>
                            <span className="ml-2 text-foreground">
                              {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString("pt-BR") : "Nunca"}
                            </span>
                          </div>
                        </div>

                        {/* Last run results */}
                        {lastRun?.results && Object.keys(lastRun.results).length > 0 && (
                          <div className="glass rounded-lg p-3 space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Último resultado</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {lastRun.results.scrape && (
                                <div>
                                  <span className="text-muted-foreground">Scrape:</span>
                                  <span className="ml-1 text-foreground font-medium">{lastRun.results.scrape.status || "—"}</span>
                                </div>
                              )}
                              {lastRun.results.enrich && (
                                <div>
                                  <span className="text-muted-foreground">Importados:</span>
                                  <span className="ml-1 text-foreground font-medium">{lastRun.results.enrich.companies_imported ?? "—"}</span>
                                </div>
                              )}
                              {lastRun.results.ipc_score && (
                                <div>
                                  <span className="text-muted-foreground">Scored:</span>
                                  <span className="ml-1 text-foreground font-medium">{lastRun.results.ipc_score.companies_scored ?? "—"}</span>
                                </div>
                              )}
                              {lastRun.results.summary && (
                                <div>
                                  <span className="text-muted-foreground">Qualificados:</span>
                                  <span className="ml-1 text-success font-bold">{lastRun.results.summary.qualified ?? "—"}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Progress bar */}
                        {(wf.success_rate || 0) > 0 && (
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${wf.success_rate}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                            />
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={runMutation.isPending}
                            onClick={(e) => { e.stopPropagation(); runMutation.mutate(wf.id); }}
                          >
                            {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            {runMutation.isPending ? "Executando..." : "Executar Agora"}
                          </Button>
                          {wf.status === "active" ? (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: wf.id, status: "paused" }); }}>
                              <Pause className="h-3 w-3" /> Pausar
                            </Button>
                          ) : wf.status === "paused" ? (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: wf.id, status: "active" }); }}>
                              <Play className="h-3 w-3" /> Ativar
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(wf.id); }}
                          >
                            <Trash2 className="h-3 w-3" /> Remover
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
      )}
    </div>
  );
};
