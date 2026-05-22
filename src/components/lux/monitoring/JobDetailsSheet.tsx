import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download, 
  AlertTriangle, 
  Play, 
  Pause, 
  Trash2,
  Activity,
  Zap,
  Globe,
  Database,
  ArrowRight,
  ChevronRight,
  Info
} from "lucide-react";
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface JobDetailsSheetProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type JobStage = {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  metrics?: string;
  error?: string;
};

export const JobDetailsSheet = ({ jobId, open, onOpenChange }: JobDetailsSheetProps) => {
  const { toast } = useToast();

  const { data: job, refetch: refetchJob } = useQuery({
    queryKey: ["scrape-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await db.from("scrape_jobs").select("*").eq("id", jobId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId && open,
    refetchInterval: (query: any) => {
      const data = query.state.data;
      return (data?.status === 'running' || data?.status === 'working' ? 3000 : false);
    },
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["scrape-results", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await db
        .from("scrape_results")
        .select("*, companies(*)")
        .eq("job_id", jobId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId && open,
  });

  const exportCSV = () => {
    if (!results || results.length === 0 || !jobId) return;
    
    const headers = ["ID", "Nome", "Setor", "Localização", "Website", "Email", "Telefone", "IPC Score"];
    const rows = results.map((res: any) => [
      res.companies?.id,
      res.companies?.name,
      res.companies?.sector,
      res.companies?.location,
      res.companies?.website,
      res.companies?.email,
      res.companies?.phone,
      res.companies?.ipc_score
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lux_export_${jobId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Exportação Concluída",
      description: "O arquivo CSV foi gerado com sucesso.",
    });
  };

  const handleAction = async (action: 'cancel' | 'retry' | 'delete') => {
    if (!jobId) return;
    try {
      if (action === 'cancel') {
        await db.from("scrape_jobs").update({ status: 'failed', error_message: 'Cancelado pelo usuário' }).eq("id", jobId);
      } else if (action === 'retry') {
        await db.from("scrape_jobs").update({ status: 'pending', error_message: null, started_at: null, completed_at: null }).eq("id", jobId);
      } else if (action === 'delete') {
        await db.from("scrape_jobs").delete().eq("id", jobId);
        onOpenChange(false);
      }
      refetchJob();
      toast({ title: "Sucesso", description: `Ação ${action} executada.` });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao executar ação.", variant: "destructive" });
    }
  };

  const config = job?.config as any;
  const progress = job?.results_count && config?.depth 
    ? Math.min(Math.round((job.results_count / (config.depth * 20)) * 100), 100) 
    : 0;

  const calculateDuration = () => {
    if (!job?.started_at) return "0s";
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const diff = differenceInSeconds(end, new Date(job.started_at));
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  };

  const getStages = (): JobStage[] => {
    const isCompleted = job?.status === 'completed';
    const isFailed = job?.status === 'failed';
    const isRunning = job?.status === 'running' || job?.status === 'working';
    
    const stages: JobStage[] = [
      {
        id: 'init',
        label: 'Inicialização',
        description: 'Preparando ambiente e parâmetros de busca.',
        icon: Play,
        status: job?.started_at ? 'completed' : isFailed ? 'failed' : 'running',
        startTime: job?.created_at,
        endTime: job?.started_at
      },
      {
        id: 'search',
        label: 'Busca de Leads',
        description: 'Consultando Google Maps e fontes externas.',
        icon: Globe,
        status: (job?.results_count || 0) > 0 ? 'completed' : isRunning ? 'running' : isFailed ? 'failed' : 'pending',
        metrics: job?.results_count ? `${job.results_count} encontrados` : undefined,
      },
      {
        id: 'parse',
        label: 'Processamento',
        description: 'Extraindo detalhes, emails e telefones.',
        icon: Database,
        status: isCompleted ? 'completed' : isRunning && (job?.results_count || 0) > 0 ? 'running' : isFailed ? 'failed' : 'pending',
      },
      {
        id: 'enrich',
        label: 'Enriquecimento',
        description: 'Qualificação via IPC e análise setorial.',
        icon: Zap,
        status: isCompleted ? 'completed' : isRunning && progress > 80 ? 'running' : isFailed ? 'failed' : 'pending',
      },
      {
        id: 'finish',
        label: 'Finalização',
        description: 'Sincronizando resultados com o workspace.',
        icon: CheckCircle2,
        status: isCompleted ? 'completed' : isFailed ? 'failed' : 'pending',
        startTime: job?.completed_at,
        error: isFailed ? job?.error_message : undefined
      }
    ];

    return stages;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-border/50 p-0 overflow-hidden">
        <div className="p-6 shrink-0 border-b border-border/50 bg-secondary/10">
          <SheetHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center border",
                  job?.status === 'completed' ? "bg-success/10 border-success/30 text-success" :
                  job?.status === 'failed' ? "bg-destructive/10 border-destructive/30 text-destructive" :
                  "bg-primary/10 border-primary/30 text-primary animate-pulse"
                )}>
                  {job?.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> :
                   job?.status === 'failed' ? <XCircle className="h-6 w-6" /> :
                   <Clock className="h-6 w-6" />}
                </div>
                <div>
                  <SheetTitle className="text-xl">{job?.name || "Detalhes da Execução"}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="font-mono text-[10px] py-0">{job?.id.slice(0, 8)}</Badge>
                    <span className="text-[10px] opacity-60">
                      Iniciado há {job?.created_at ? formatDistanceToNow(new Date(job.created_at), { locale: ptBR, addSuffix: true }) : '-'}
                    </span>
                  </SheetDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={exportCSV} disabled={!results?.length}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10" onClick={() => handleAction('delete')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-border/50 bg-secondary/5">
            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 p-0">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-sm gap-2">
                <Activity className="h-4 w-4" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="leads" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-sm gap-2">
                <Building2 className="h-4 w-4" /> Leads ({job?.results_count || 0})
              </TabsTrigger>
              <TabsTrigger value="config" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-sm gap-2">
                <FileText className="h-4 w-4" /> Configuração
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
                {/* Status Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status Atual</span>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", 
                        job?.status === 'completed' ? "bg-success" : 
                        job?.status === 'failed' ? "bg-destructive" : "bg-primary animate-pulse"
                      )} />
                      <span className="font-semibold capitalize">{job?.status}</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duração</span>
                    <span className="font-semibold">{calculateDuration()}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Métrica IPC</span>
                    <span className="font-semibold">{Math.round((results?.filter((r: any) => (r.companies?.ipc_score || 0) > 70).length || 0) / (results?.length || 1) * 100)}% qualificados</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {(job?.status === 'running' || job?.status === 'working') && (
                  <div className="space-y-3 p-5 rounded-2xl bg-primary/5 border border-primary/20">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Executando Extração...</p>
                        <p className="text-xs text-muted-foreground">Isso pode levar alguns minutos dependendo da profundidade.</p>
                      </div>
                      <span className="text-lg font-bold text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-primary/10" />
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm tracking-tight uppercase">Linha do Tempo</h3>
                  </div>
                  <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                    {getStages().map((stage, i) => (
                      <div key={stage.id} className="relative flex items-start gap-4">
                        <div className={cn(
                          "mt-1.5 h-[2.25rem] w-[2.25rem] rounded-full border-4 border-background flex items-center justify-center shrink-0 z-10 transition-all duration-500",
                          stage.status === 'completed' ? "bg-success text-white scale-110 shadow-lg shadow-success/20" :
                          stage.status === 'running' ? "bg-primary text-white animate-pulse" :
                          stage.status === 'failed' ? "bg-destructive text-white" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          <stage.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 pt-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className={cn("text-sm font-bold", stage.status === 'pending' && "text-muted-foreground")}>
                              {stage.label}
                            </h4>
                            {stage.startTime && (
                              <span className="text-[10px] font-mono opacity-50">
                                {format(new Date(stage.startTime), "HH:mm:ss")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {stage.description}
                          </p>
                          {stage.metrics && (
                            <Badge variant="secondary" className="mt-1 text-[10px] font-mono bg-secondary/50">
                              {stage.metrics}
                            </Badge>
                          )}
                          {stage.error && (
                            <div className="mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                              <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                              <p className="text-[10px] font-mono text-destructive leading-tight">{stage.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex gap-3 pt-4">
                  {job?.status === 'failed' && (
                    <Button className="flex-1 h-12 rounded-2xl gap-2 shadow-lg shadow-primary/20" onClick={() => handleAction('retry')}>
                      <Play className="h-4 w-4" /> Tentar Novamente
                    </Button>
                  )}
                  {(job?.status === 'running' || job?.status === 'working' || job?.status === 'pending') && (
                    <Button variant="outline" className="flex-1 h-12 rounded-2xl gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50" onClick={() => handleAction('cancel')}>
                      <Pause className="h-4 w-4" /> Interromper
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="leads" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm tracking-tight uppercase">Empresas Processadas</h3>
                  </div>
                  <Badge variant="secondary">{results?.length || 0} de {job?.results_count || 0}</Badge>
                </div>

                <div className="space-y-3">
                  {resultsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-20 w-full bg-secondary/10 rounded-2xl animate-pulse" />
                    ))
                  ) : results && results.length > 0 ? (
                    results.map((res: any) => (
                      <motion.div 
                        key={res.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl border border-border/50 bg-secondary/5 flex items-center justify-between group hover:border-primary/40 hover:bg-secondary/10 transition-all cursor-default"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center border border-border/50 group-hover:border-primary/20">
                            <Building2 className="h-5 w-5 text-primary/70" />
                          </div>
                          <div>
                            <p className="text-sm font-bold group-hover:text-primary transition-colors">{res.companies?.name || "Empresa Desconhecida"}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                              {res.companies?.sector || "Sem setor"}
                              <span className="opacity-30">•</span>
                              {res.companies?.location?.split(',')[0] || "Sem local"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">IPC</p>
                            <p className={cn(
                              "text-sm font-black",
                              (res.companies?.ipc_score || 0) > 70 ? "text-success" : 
                              (res.companies?.ipc_score || 0) > 40 ? "text-warning" : "text-muted-foreground"
                            )}>
                              {res.companies?.ipc_score || 0}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-secondary/5 rounded-3xl border border-dashed border-border/50">
                      <Building2 className="h-12 w-12 mb-4 opacity-10" />
                      <p className="text-sm font-medium">Nenhum resultado processado ainda.</p>
                      <p className="text-xs opacity-60">As empresas aparecerão conforme a extração avança.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="config" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm tracking-tight uppercase">Parâmetros da Tarefa</h3>
                </div>

                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase font-bold">Fonte</label>
                      <p className="text-sm font-medium capitalize">{job?.source || 'Google Maps'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase font-bold">Sync Automático</label>
                      <Badge variant="outline">{job?.auto_sync ? 'Ativado' : 'Desativado'}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold">Palavras-chave</label>
                    <div className="flex flex-wrap gap-2">
                      {config?.keywords?.map((k: string) => (
                        <Badge key={k} variant="secondary" className="bg-secondary/30">{k}</Badge>
                      )) || <span className="text-sm opacity-50">Nenhuma definida</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase font-bold">Raio de Busca</label>
                      <p className="text-sm font-medium">{(config?.radius || 0) / 1000} km</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase font-bold">Profundidade</label>
                      <p className="text-sm font-medium">{config?.depth || 1} {config?.depth === 1 ? 'nível' : 'níveis'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border/50">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold">Metadados Técnicos</label>
                    <pre className="p-4 rounded-xl bg-black/40 text-[10px] font-mono text-primary/80 overflow-x-auto border border-white/5">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
