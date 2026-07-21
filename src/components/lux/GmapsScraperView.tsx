import { useState, useEffect } from "react";
import { validateScrapeJob } from "@/lib/schemas/scrapeJob";
import { useAuth } from "@/contexts/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, Download, RefreshCw, Search, Globe, Mail, Clock, CheckCircle2, AlertCircle, Loader2, Zap, Eye, DatabaseIcon, FileDown } from "lucide-react";
import { DataError } from "@/components/lux/DataError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gmapsApi, type ScrapeJob } from "@/lib/api/gmaps";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: "Concluído", color: "bg-success/20 text-success border-success/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  ok: { label: "Concluído", color: "bg-success/20 text-success border-success/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  running: { label: "Executando", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  working: { label: "Trabalhando", color: "bg-blue-500/20 text-blue-500 border-blue-500/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending: { label: "Pendente", color: "bg-warning/20 text-warning border-warning/30", icon: <Clock className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
  failed: { label: "Falha", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
};

const getStatus = (status: string) => statusConfig[status] || statusConfig["pending"];

export const GmapsScraperView = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [jobName, setJobName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [lang, setLang] = useState<"pt" | "en" | "es">("pt");
  const [radius, setRadius] = useState(10000);
  const [depth, setDepth] = useState(1);
  const [extractEmail, setExtractEmail] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const [extraReviews, setExtraReviews] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gmaps-jobs"],
    queryFn: gmapsApi.listJobs,
    refetchInterval: 10000,
    retry: 2,
    retryDelay: 3000,
  });

  // Realtime subscription for scrape_jobs
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`private:${user.id}:gmaps-jobs`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scrape_jobs", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const jobs = data?.jobs || [];
  const apiOnline = data?.api_online ?? false;

  const createMutation = useMutation({
    mutationFn: gmapsApi.createJob,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] });
      toast({ title: "Job criado!", description: result.external_id ? "Raspagem iniciada na API externa." : "Salvo no banco. API externa indisponível." });
      setCreateDialogOpen(false);
      setJobName("");
      setKeywords("");
    },
    onError: (err) => {
      toast({ title: "Erro", description: `Falha ao criar job: ${err.message}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: gmapsApi.deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] });
      toast({ title: "Job removido", description: "O job foi deletado com sucesso." });
    },
    onError: (err) => {
      toast({ title: "Erro", description: `Falha ao deletar: ${err.message}`, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: gmapsApi.syncResults,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] });
      toast({ title: "Resultados importados!", description: `${result.companies_created} empresas criadas e qualificadas pelo IPC.` });
    },
    onError: (err) => {
      toast({ title: "Erro", description: `Falha ao importar: ${err.message}`, variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: ({ jobId, format }: { jobId: string; format: "csv" | "json" }) => gmapsApi.exportJob(jobId, format),
    onSuccess: (_, vars) => toast({ title: "Exportação iniciada", description: `Arquivo ${vars.format.toUpperCase()} baixado.` }),
    onError: (err) => toast({ title: "Erro", description: `Falha ao exportar: ${err.message}`, variant: "destructive" }),
  });

  const handleCreate = () => {
    const result = validateScrapeJob({
      name: jobName,
      keywords,
      lang,
      radius,
      depth,
      email: extractEmail,
      fast_mode: fastMode,
      auto_sync: autoSync,
    });
    if (!result.success) {
      const firstError = Object.values(result.errors)[0];
      toast({ title: "Corrija os campos", description: firstError, variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: jobName.trim(),
      keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      lang,
      radius,
      depth,
      email: extractEmail,
      fast_mode: fastMode,
      extra_reviews: extraReviews,
      auto_sync: autoSync,
    });
  };

  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "ok").length;
  const runningJobs = jobs.filter(j => j.status === "running").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Google Maps Scraper
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Raspagem de empresas via Google Places — {jobs.length} jobs total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] })} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Raspagem
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/50">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Nova Raspagem Google Maps
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome do Job</Label>
                  <Input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Ex: Restaurantes São Paulo" className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Palavras-chave (separadas por vírgula)</Label>
                  <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Ex: restaurantes, pizzarias, bares" className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Idioma</Label>
                    <Select value={lang} onValueChange={(v) => setLang(v as "pt" | "en" | "es")}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Português</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Profundidade</Label>
                    <Select value={String(depth)} onValueChange={v => setDepth(Number(v))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Rápido)</SelectItem>
                        <SelectItem value="2">2 (Médio)</SelectItem>
                        <SelectItem value="3">3 (Profundo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Raio de busca: {(radius / 1000).toFixed(0)}km</Label>
                  <Slider value={[radius]} onValueChange={([v]) => setRadius(v)} min={1000} max={50000} step={1000} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Extrair emails</p>
                    <p className="text-[10px] text-muted-foreground">Busca emails no site de cada empresa</p>
                  </div>
                  <Switch checked={extractEmail} onCheckedChange={setExtractEmail} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Sincronização automática</p>
                    <p className="text-[10px] text-muted-foreground">Importa para o CRM assim que concluir</p>
                  </div>
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending || !jobName.trim() || !keywords.trim()} className="w-full gap-2">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {createMutation.isPending ? "Criando..." : "Iniciar Raspagem"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de Jobs", value: jobs.length, color: "text-foreground" },
          { label: "Concluídos", value: completedJobs, color: "text-success" },
          { label: "Em Execução", value: runningJobs, color: "text-primary" },
          { label: "API Status", value: error ? "Erro" : apiOnline ? "Online" : "Offline (DB)", color: error ? "text-destructive" : apiOnline ? "text-success" : "text-warning" },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            <p className={`text-xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Jobs list */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Jobs de Raspagem</h3>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {error ? (
          <div className="p-4">
            <DataError message={error.message} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Carregando jobs...</p>
          </div>
        ) : jobs.length > 0 ? (
          <div className="divide-y divide-border/20">
            {jobs.map((job, i) => {
              const status = getStatus(job.status);
              const isExpanded = expandedJob === job.id;
              const config = job.config;
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div
                    className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{job.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(job.created_at).toLocaleDateString("pt-BR")} {new Date(job.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {config?.keywords && (
                              <Badge variant="outline" className="text-[10px] bg-secondary/50">
                                {config.keywords.slice(0, 2).join(", ")}{config.keywords.length > 2 ? ` +${config.keywords.length - 2}` : ""}
                              </Badge>
                            )}
                            {job.results_count > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                                {job.results_count} empresas
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs gap-1 ${status.color}`}>
                          {status.icon} {status.label}
                        </Badge>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-3 border-t border-border/20 space-y-3">
                            {config && (
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Idioma:</span>
                                    <span className="ml-1 text-foreground font-medium">{config.lang}</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Raio:</span>
                                    <span className="ml-1 text-foreground font-medium font-mono">{(config.radius / 1000).toFixed(0)}km</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Profundidade:</span>
                                    <span className="ml-1 text-foreground font-medium font-mono">{config.depth}</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Email:</span>
                                    <span className="ml-1 text-foreground font-medium">{config.email ? "Sim" : "Não"}</span>
                                  </div>
                                </div>
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Keywords:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {config.keywords.map((kw: string, ki: number) => (
                                      <Badge key={ki} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{kw}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                            <div className="flex gap-2 pt-1">
                              {(job.status === "completed" || job.status === "ok") && job.external_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  disabled={syncMutation.isPending}
                                  onClick={(e) => { e.stopPropagation(); syncMutation.mutate(job.id); }}
                                >
                                  {syncMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseIcon className="h-3.5 w-3.5" />}
                                  Importar & Qualificar IPC
                                </Button>
                              )}
                              {job.status === "running" || job.status === "working" || job.status === "pending" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs text-warning hover:text-warning"
                                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(job.id); }}
                                >
                                  <AlertCircle className="h-3.5 w-3.5" /> Cancelar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(job.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Deletar
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum job encontrado</p>
            <p className="text-xs mt-1">Crie uma nova raspagem para começar</p>
          </div>
        )}
      </div>
    </div>
  );
};
