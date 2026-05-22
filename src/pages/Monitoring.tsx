import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
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
  MoreVertical
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobDetailsSheet } from "@/components/lux/monitoring/JobDetailsSheet";
import { useRealtimeScrapeJobs } from "@/hooks/useRealtimeScrapeJobs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const AutomationMonitoring = () => {
  const [activeTab, setActiveTab] = useState("runs");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Enable realtime updates for scrape jobs
  useRealtimeScrapeJobs();

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["automation-jobs", page, searchTerm],
    queryFn: async () => {
      let query = db
        .from("scrape_jobs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    }
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data: logs, error: logsError } = await db
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (logsError) throw logsError;

      const actorIds = [...new Set(logs.map(l => l.actor_id).filter(Boolean))];
      
      if (actorIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", actorIds as string[]);
        
        return logs.map(log => ({
          ...log,
          actor: profiles?.find(p => p.id === log.actor_id)
        }));
      }

      return logs.map(log => ({ ...log, actor: null }));
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

  const filteredJobs = jobs?.filter(j => 
    j.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'running':
      case 'working': return 'secondary';
      default: return 'outline';
    }
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar execuções..." 
            className="pl-9 bg-secondary/20 border-border/40 focus:bg-background transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={handleManualSync} className="shrink-0 border-border/40">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="shrink-0 border-border/40">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="runs" className="gap-2">
            <History className="h-4 w-4" />
            Execuções
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Trilha de Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          {jobsLoading ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {[1,2,3].map(i => <div key={i} className="h-48 glass rounded-xl animate-pulse" />)}
             </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredJobs?.map((job) => (
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
                            <DropdownMenuItem className="gap-2 text-xs">
                              <ExternalLink className="h-3 w-3" />
                              Exportar CSV
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <Card className="glass border-border/40 overflow-hidden">
            <CardHeader className="bg-secondary/20">
              <CardTitle className="text-lg">Registro de Auditoria</CardTitle>
              <CardDescription>Eventos de sistema e ações administrativas por workspace.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-border/20">
                  {auditLoading ? (
                    [1,2,3,4,5].map(i => <div key={i} className="h-20 w-full bg-muted/50 animate-pulse" />)
                  ) : auditLogs?.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                      Nenhum registro de auditoria encontrado.
                    </div>
                  ) : auditLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-secondary/10 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border/30 overflow-hidden">
                        {log.actor?.avatar_url ? (
                          <img src={log.actor.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            <span className="text-primary font-semibold">{log.action}</span> em <span className="font-mono bg-secondary/50 px-1 rounded text-xs">{log.table_name}</span>
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-secondary/30 px-2 py-0.5 rounded-full border border-border/20">
                            {format(new Date(log.created_at), "HH:mm:ss · dd MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          Ator: <span className="text-foreground/80 font-medium">{log.actor?.full_name || 'Sistema'}</span>
                          <span className="text-[10px] opacity-40">({log.actor_id?.slice(0,8)})</span>
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-2 text-[10px] font-mono p-3 bg-black/40 rounded-lg border border-white/5 overflow-x-auto text-primary/80">
                            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
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
