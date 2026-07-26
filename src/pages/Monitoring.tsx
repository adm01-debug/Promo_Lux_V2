import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { 
  History, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ExternalLink,
  ShieldCheck,
  User,
  Calendar,
  Building2,
  RefreshCw,
  MoreVertical,
  Download,
  Bell,
  Mail,
  Settings2,
  Database
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, subDays, startOfDay, endOfDay, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobDetailsSheet } from "@/components/lux/monitoring/JobDetailsSheet";
import { DbHealthDashboard } from "@/components/lux/monitoring/DbHealthDashboard";
import { ScrapeQueuePanel } from "@/components/lux/monitoring/ScrapeQueuePanel";
import { ListChecks, Layers, ShieldAlert, FileText, Gauge, Activity } from "lucide-react";
import { AutomationsRealtimeView } from "@/components/lux/automations/AutomationsRealtimeView";
import { PartitionAdvisoryPanel } from "@/components/lux/monitoring/PartitionAdvisoryPanel";
import { ResilienceSimulatorPanel } from "@/components/lux/monitoring/ResilienceSimulatorPanel";
import { CircuitBreakerPanel } from "@/components/lux/monitoring/CircuitBreakerPanel";
import { AutomationLogsPanel } from "@/components/lux/monitoring/AutomationLogsPanel";
import { AutomationStatusPanel } from "@/components/lux/monitoring/AutomationStatusPanel";
import { AuditTrailPanel } from "@/components/lux/monitoring/AuditTrailPanel";
import { ApiLatencyPanel } from "@/components/lux/monitoring/ApiLatencyPanel";
import { ApiLatencyAlertSettingsCard } from "@/components/lux/monitoring/ApiLatencyAlertSettingsCard";
import { VaultCookiesPanel } from "@/components/lux/monitoring/VaultCookiesPanel";
import { OrgProxiesView } from "@/components/lux/OrgProxiesView";
import { DlqTriageView } from "@/components/lux/monitoring/DlqTriageView";
import { ScrapeLatencyPanel } from "@/components/lux/monitoring/ScrapeLatencyPanel";
import { OrgRateLimitsView } from "@/components/lux/monitoring/OrgRateLimitsView";
import { ResilienceReport } from "@/components/lux/monitoring/ResilienceReport";
import { MultiQueueResilienceCard } from "@/components/lux/monitoring/MultiQueueResilienceCard";
import { RetryPolicyAdvisoriesPanel } from "@/components/lux/monitoring/RetryPolicyAdvisoriesPanel";
import { ChaosEngineeringPanel } from "@/components/lux/monitoring/ChaosEngineeringPanel";
import { MonteCarloReportPanel } from "@/components/lux/monitoring/MonteCarloReportPanel";
import { WebScrapeView } from "@/components/lux/monitoring/WebScrapeView";
import { InstagramConnectionPanel } from "@/components/lux/monitoring/InstagramConnectionPanel";
import { DLQReplayPanel } from "@/components/lux/monitoring/DLQReplayPanel";
import { QaHistoryPanel } from "@/components/lux/monitoring/QaHistoryPanel";
import { ReaperHistoryPanel } from "@/components/lux/monitoring/ReaperHistoryPanel";
import { SlaCompliancePanel } from "@/components/lux/monitoring/SlaCompliancePanel";
import { SlaTrendChart } from "@/components/lux/monitoring/SlaTrendChart";
import { SlaRecommendationsCard } from "@/components/lux/monitoring/SlaRecommendationsCard";
import { RotateCcw } from "lucide-react";
import { Cookie, Shield, ShieldAlert as ShieldAlertIcon, Timer, LineChart as LineChartIcon, Sparkles, Zap, Globe, Camera, FlaskConical } from "lucide-react";

import { useRealtimeScrapeJobs } from "@/hooks/useRealtimeScrapeJobs";
import { useAuth } from "@/contexts/auth-context";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type ScrapeJobRow = Tables<"scrape_jobs">;


const AutomationMonitoring = () => {
  const [activeTab, setActiveTab] = useState("realtime");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("7"); // days
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Enable realtime updates for scrape jobs
  useRealtimeScrapeJobs();

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["automation-jobs", page, searchTerm, statusFilter, periodFilter, user?.id],
    queryFn: async () => {
      const activeOrgId = getActiveOrgId();
      if (!activeOrgId) return { data: [], count: 0 };
      
      // 'estimated' usa pg_class.reltuples (O(1)) — evita scan completo em cada página.
      // Preciso o suficiente para paginação; ANALYZE mantém a estimativa atualizada.
      let query = db
        .from("scrape_jobs")
        .select("*", { count: "estimated" })
        .order("created_at", { ascending: false });
      
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as ScrapeJobRow["status"]);
      }

      if (periodFilter !== "all") {
        const days = parseInt(periodFilter);
        const dateLimit = subDays(new Date(), days).toISOString();
        query = query.gte("created_at", dateLimit);
      }

      const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return { data, count };
    }
  });

  const { data: alertSettings, refetch: refetchAlerts } = useQuery({
    queryKey: ["automation-alerts"],
    queryFn: async () => {
      const { data, error } = await db.from("automation_alerts").select("*");
      if (error) throw error;
      return data;
    }
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ type, method, active }: { type: string, method: string, active: boolean }) => {
      const existing = alertSettings?.find(a => a.event_type === type && a.delivery_method === method);
      if (existing) {
        return await db.from("automation_alerts").update({ is_active: active }).eq("id", existing.id);
      } else if (user?.id) {
        return await db.from("automation_alerts").insert([{
          event_type: type,
          delivery_method: method,
          is_active: active,
          user_id: user.id
        }]);
      }
    },
    onSuccess: () => {
      refetchAlerts();
      toast({ title: "Configurações Salvas", description: "Suas preferências de alerta foram atualizadas." });
    }
  });


  const handleOpenDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsDetailsOpen(true);
  };

  const handleManualSync = () => {
    refetchJobs();
    toast({
      title: "Sincronizando",
      description: "Buscando atualizações de status...",
    });
  };

  const handleExportAll = () => {
    if (!jobs?.data) return;
    
    const headers = ["ID", "Nome", "Status", "Empresas", "Criado em", "Duração"];
    const rows = jobs.data.map((job: ScrapeJobRow) => [
      job.id,
      job.name,
      job.status,
      job.results_count || 0,
      format(new Date(job.created_at), "dd/MM/yyyy HH:mm"),
      job.started_at && job.completed_at ? 
        `${differenceInSeconds(new Date(job.completed_at), new Date(job.started_at))}s` : '-'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lux_monitoring_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.click();
    
    toast({ title: "Exportação Iniciada", description: "O relatório CSV está sendo baixado." });
  };

  const jobsData = jobs?.data || [];
  const totalCount = jobs?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'running':
      case 'working': return 'secondary';
      default: return 'outline';
    }
  };

  const isAlertActive = (type: string, method: string) => {
    return alertSettings?.find(a => a.event_type === type && a.delivery_method === method)?.is_active ?? false;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
          Monitoramento de Automações
        </h1>
        <p className="text-muted-foreground">
          Acompanhe o status, logs e auditoria de todas as execuções de scraping e enriquecimento.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar execuções..." 
            className="pl-9 bg-secondary/20 border-border/40 focus:bg-background transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-9 px-3 border-border/40 bg-secondary/10 flex items-center gap-2 font-normal">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <select 
              className="bg-transparent border-none outline-none text-xs cursor-pointer font-medium"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Concluídos</option>
              <option value="failed">Falhas</option>
              <option value="running">Executando</option>
              <option value="pending">Pendentes</option>
            </select>
          </Badge>

          <Badge variant="outline" className="h-9 px-3 border-border/40 bg-secondary/10 flex items-center gap-2 font-normal">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <select 
              className="bg-transparent border-none outline-none text-xs cursor-pointer font-medium"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="1">Últimas 24h</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="all">Todo o Período</option>
            </select>
          </Badge>
        </div>

        <div className="flex gap-2 ml-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 border-border/40">
                <Bell className="h-4 w-4" />
                Alertas
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Configurações de Alerta
                </DialogTitle>
                <DialogDescription>
                  Escolha como deseja ser notificado sobre suas automações.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold border-b pb-2">Finalização com Sucesso</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 opacity-70" />
                      <Label htmlFor="succ-push">Notificação Push</Label>
                    </div>
                    <Switch 
                      id="succ-push" 
                      checked={isAlertActive('job_completed', 'push')}
                      onCheckedChange={(v) => updateAlertMutation.mutate({ type: 'job_completed', method: 'push', active: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 opacity-70" />
                      <Label htmlFor="succ-email">E-mail</Label>
                    </div>
                    <Switch 
                      id="succ-email" 
                      checked={isAlertActive('job_completed', 'email')}
                      onCheckedChange={(v) => updateAlertMutation.mutate({ type: 'job_completed', method: 'email', active: v })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold border-b pb-2 text-destructive">Falhas na Execução</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 opacity-70" />
                      <Label htmlFor="fail-push">Notificação Push</Label>
                    </div>
                    <Switch 
                      id="fail-push" 
                      checked={isAlertActive('job_failed', 'push')}
                      onCheckedChange={(v) => updateAlertMutation.mutate({ type: 'job_failed', method: 'push', active: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 opacity-70" />
                      <Label htmlFor="fail-email">E-mail</Label>
                    </div>
                    <Switch 
                      id="fail-email" 
                      checked={isAlertActive('job_failed', 'email')}
                      onCheckedChange={(v) => updateAlertMutation.mutate({ type: 'job_failed', method: 'email', active: v })}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleExportAll} className="h-9 gap-2 border-border/40">
            <Download className="h-4 w-4" />
            Exportar
          </Button>

          <Button variant="outline" size="sm" onClick={handleManualSync} className="h-9 gap-2 border-border/40">
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="realtime" className="gap-2">
            <Activity className="h-4 w-4" />
            Tempo Real
          </TabsTrigger>
          <TabsTrigger value="automation-status" className="gap-2">
            <Activity className="h-4 w-4" />
            Status Automações
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-2">
            <History className="h-4 w-4" />
            Execuções
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Trilha de Auditoria
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <Database className="h-4 w-4" />
            Saúde do Banco
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Fila de Scraping
          </TabsTrigger>
          <TabsTrigger value="partitions" className="gap-2">
            <Layers className="h-4 w-4" />
            Particionamento
          </TabsTrigger>
          <TabsTrigger value="resilience" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Simulador de Falhas
          </TabsTrigger>
          <TabsTrigger value="circuit-breakers" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Disjuntores
          </TabsTrigger>
          <TabsTrigger value="latency" className="gap-2">
            <Gauge className="h-4 w-4" />
            Latência
          </TabsTrigger>
          <TabsTrigger value="automation-logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Auditoria de Execução
          </TabsTrigger>
          <TabsTrigger value="vault-cookies" className="gap-2">
            <Cookie className="h-4 w-4" />
            Cookies do Vault
          </TabsTrigger>
          <TabsTrigger value="proxies" className="gap-2">
            <Shield className="h-4 w-4" />
            Proxies
          </TabsTrigger>
          <TabsTrigger value="dlq-triage" className="gap-2">
            <ShieldAlertIcon className="h-4 w-4" />
            Triagem DLQ
          </TabsTrigger>
          <TabsTrigger value="scrape-latency" className="gap-2">
            <Timer className="h-4 w-4" />
            Latência Motor
          </TabsTrigger>
          <TabsTrigger value="rate-limits" className="gap-2">
            <Gauge className="h-4 w-4" />
            Rate Limits
          </TabsTrigger>
          <TabsTrigger value="resilience-report" className="gap-2">
            <LineChartIcon className="h-4 w-4" />
            Resiliência
          </TabsTrigger>
          <TabsTrigger value="retry-tuner" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Auto-Tuner
          </TabsTrigger>
          <TabsTrigger value="chaos" className="gap-2">
            <Zap className="h-4 w-4" />
            Chaos
          </TabsTrigger>
          <TabsTrigger value="monte-carlo" className="gap-2">
            <LineChartIcon className="h-4 w-4" />
            Monte Carlo
          </TabsTrigger>
          <TabsTrigger value="web-scrape" className="gap-2">
            <Globe className="h-4 w-4" />
            Web Scrape
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2">
            <Camera className="h-4 w-4" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="dlq-replay" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            DLQ Replay
          </TabsTrigger>
          <TabsTrigger value="qa-history" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Histórico QA
          </TabsTrigger>
          <TabsTrigger value="reaper" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reaper
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Timer className="h-4 w-4" />
            SLA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qa-history" className="space-y-4">
          <QaHistoryPanel />
        </TabsContent>

        <TabsContent value="reaper" className="space-y-4">
          <ReaperHistoryPanel />
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <SlaCompliancePanel />
          <SlaRecommendationsCard />
          <SlaTrendChart />
        </TabsContent>

        <TabsContent value="dlq-replay" className="space-y-4">
          <DLQReplayPanel />
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <AutomationsRealtimeView />
        </TabsContent>

        <TabsContent value="automation-status" className="space-y-4">
          <AutomationStatusPanel />
        </TabsContent>


        <TabsContent value="runs" className="space-y-4">
          {jobsLoading ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {[1,2,3].map(i => <div key={i} className="h-48 glass rounded-xl animate-pulse" />)}
             </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobsData.map((job: ScrapeJobRow) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="glass group hover:border-primary/30 transition-all cursor-pointer" onClick={() => handleOpenDetails(job.id)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {job.name || "Tarefa Sem Nome"}
                            {job.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            {job.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                            {(job.status === 'running' || job.status === 'working') && <Clock className="h-4 w-4 text-primary animate-spin" />}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono">
                            ID: {job.external_id || job.id.slice(0,8)}
                          </CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          {job.results_count || 0} empresas
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {job.created_at ? format(new Date(job.created_at), "dd MMM, HH:mm", { locale: ptBR }) : '-'}
                        </span>
                      </div>
                      
                      {job.error_message && (
                        <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-[10px] text-destructive font-mono truncate">
                          {job.error_message}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs gap-1.5 h-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(job.id);
                          }}
                        >
                          <Terminal className="h-3 w-3" />
                          Logs & Detalhes
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-lg">
                            <DropdownMenuItem className="gap-2 text-xs" onClick={(e) => { e.stopPropagation(); /* Logic in JobDetailsSheet */ }}>
                              <ExternalLink className="h-3 w-3" />
                              Exportar Resultados
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-xs text-destructive">
                              <XCircle className="h-3 w-3" />
                              Cancelar Execução
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrailPanel />
        </TabsContent>



        <TabsContent value="database" className="space-y-4">
          <DbHealthDashboard />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <ScrapeQueuePanel />
        </TabsContent>

        <TabsContent value="partitions" className="space-y-4">
          <PartitionAdvisoryPanel />
        </TabsContent>

        <TabsContent value="resilience" className="space-y-4">
          <ResilienceSimulatorPanel />
        </TabsContent>

        <TabsContent value="circuit-breakers" className="space-y-4">
          <CircuitBreakerPanel />
        </TabsContent>

        <TabsContent value="latency" className="space-y-4">
          <ApiLatencyPanel />
          <ApiLatencyAlertSettingsCard />
        </TabsContent>

        <TabsContent value="automation-logs" className="space-y-4">

          <AutomationLogsPanel />
        </TabsContent>

        <TabsContent value="vault-cookies" className="space-y-4">
          <VaultCookiesPanel />
        </TabsContent>

        <TabsContent value="proxies" className="space-y-4">
          <OrgProxiesView />
        </TabsContent>

        <TabsContent value="dlq-triage" className="space-y-4">
          <DlqTriageView />
        </TabsContent>

        <TabsContent value="scrape-latency" className="space-y-4">
          <ScrapeLatencyPanel />
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <OrgRateLimitsView />
        </TabsContent>

        <TabsContent value="resilience-report" className="space-y-4">
          <MultiQueueResilienceCard />
          <ResilienceReport />
        </TabsContent>

        <TabsContent value="retry-tuner" className="space-y-4">
          <RetryPolicyAdvisoriesPanel />
        </TabsContent>

        <TabsContent value="chaos" className="space-y-4">
          <ChaosEngineeringPanel />
        </TabsContent>

        <TabsContent value="monte-carlo" className="space-y-4">
          <MonteCarloReportPanel />
        </TabsContent>

        <TabsContent value="web-scrape" className="space-y-4">
          <WebScrapeView />
        </TabsContent>

        <TabsContent value="instagram" className="space-y-4">
          <InstagramConnectionPanel />
        </TabsContent>

      </Tabs>

      <JobDetailsSheet 
        jobId={selectedJobId} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
      />
    </div>
  );
};

export default AutomationMonitoring;
