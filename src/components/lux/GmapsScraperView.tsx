import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, Download, RefreshCw, Search, Globe, Mail, Clock, CheckCircle2, AlertCircle, Loader2, Zap, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gmapsApi, type GmapsJob } from "@/lib/api/gmaps";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ok: { label: "Concluído", color: "bg-success/20 text-success border-success/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  running: { label: "Executando", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending: { label: "Pendente", color: "bg-warning/20 text-warning border-warning/30", icon: <Clock className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
};

const getStatus = (status: string) => statusConfig[status] || statusConfig["pending"];

export const GmapsScraperView = () => {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [jobName, setJobName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [lang, setLang] = useState("pt");
  const [radius, setRadius] = useState(10000);
  const [depth, setDepth] = useState(1);
  const [extractEmail, setExtractEmail] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["gmaps-jobs"],
    queryFn: gmapsApi.listJobs,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: gmapsApi.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmaps-jobs"] });
      toast({ title: "Job criado!", description: "A raspagem foi iniciada com sucesso." });
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

  const handleCreate = () => {
    if (!jobName.trim() || !keywords.trim()) return;
    createMutation.mutate({
      name: jobName.trim(),
      keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      lang,
      radius,
      depth,
      email: extractEmail,
      fast_mode: fastMode,
    });
  };

  const completedJobs = jobs?.filter(j => j.Status === "ok").length || 0;
  const runningJobs = jobs?.filter(j => j.Status === "running").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Google Maps Scraper
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Raspagem de empresas via Google Places — {jobs?.length || 0} jobs total
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
                    <Select value={lang} onValueChange={setLang}>
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
                    <p className="text-sm text-foreground">Modo rápido</p>
                    <p className="text-[10px] text-muted-foreground">Menos detalhes, mais velocidade</p>
                  </div>
                  <Switch checked={fastMode} onCheckedChange={setFastMode} />
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
          { label: "Total de Jobs", value: jobs?.length || 0, color: "text-foreground" },
          { label: "Concluídos", value: completedJobs, color: "text-success" },
          { label: "Em Execução", value: runningJobs, color: "text-primary" },
          { label: "API Status", value: error ? "Offline" : "Online", color: error ? "text-destructive" : "text-success" },
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
          <div className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">Erro ao carregar jobs</p>
            <p className="text-xs text-muted-foreground mt-1">Verifique a conexão com a API</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Carregando jobs...</p>
          </div>
        ) : jobs && jobs.length > 0 ? (
          <div className="divide-y divide-border/20">
            {jobs.slice().sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()).map((job, i) => {
              const status = getStatus(job.Status);
              const isExpanded = expandedJob === job.ID;
              return (
                <motion.div
                  key={job.ID}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div
                    className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedJob(isExpanded ? null : job.ID)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{job.Name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(job.Date).toLocaleDateString("pt-BR")} {new Date(job.Date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-secondary/50">
                              {job.Data.keywords.slice(0, 2).join(", ")}{job.Data.keywords.length > 2 ? ` +${job.Data.keywords.length - 2}` : ""}
                            </Badge>
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="text-xs">
                                <span className="text-muted-foreground">Idioma:</span>
                                <span className="ml-1 text-foreground font-medium">{job.Data.lang}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Raio:</span>
                                <span className="ml-1 text-foreground font-medium font-mono">{(job.Data.radius / 1000).toFixed(0)}km</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Profundidade:</span>
                                <span className="ml-1 text-foreground font-medium font-mono">{job.Data.depth}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Email:</span>
                                <span className="ml-1 text-foreground font-medium">{job.Data.email ? "Sim" : "Não"}</span>
                              </div>
                            </div>
                            <div className="text-xs">
                              <span className="text-muted-foreground">Keywords:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {job.Data.keywords.map((kw, ki) => (
                                  <Badge key={ki} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{kw}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              {job.Status === "ok" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  onClick={(e) => { e.stopPropagation(); window.open(gmapsApi.getDownloadUrl(job.ID), "_blank"); }}
                                >
                                  <Download className="h-3.5 w-3.5" /> Download CSV
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 text-xs text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(job.ID); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Deletar
                              </Button>
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
