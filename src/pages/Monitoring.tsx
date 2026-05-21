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
  Building2
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AutomationMonitoring = () => {
  const [activeTab, setActiveTab] = useState("runs");
  const [searchTerm, setSearchTerm] = useState("");

  // Query para buscar jobs de raspagem
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["automation-jobs"],
    queryFn: async () => {
      const { data, error } = await db.from("scrape_jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Query para auditoria
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }
  });

  const filteredJobs = jobs?.filter(j => 
    j.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
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
                  <Card className="glass group hover:border-primary/30 transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {job.name || "Tarefa Sem Nome"}
                            {job.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success" />}
                            {job.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                            {job.status === 'processing' && <Clock className="h-4 w-4 text-primary animate-spin" />}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono">
                            ID: {job.external_id || job.id.slice(0,8)}
                          </CardDescription>
                        </div>
                        <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'secondary'}>
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
                        <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 h-8">
                          <Terminal className="h-3 w-3" />
                          Ver Logs
                        </Button>
                        <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5 h-8">
                          <ExternalLink className="h-3 w-3" />
                          Resultados
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Registro de Auditoria</CardTitle>
              <CardDescription>Eventos de sistema e ações administrativas por workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {auditLoading ? (
                    [1,2,3].map(i => <div key={i} className="h-12 w-full bg-muted/50 rounded animate-pulse" />)
                  ) : auditLogs?.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg border border-border/30 hover:bg-secondary/20 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            <span className="text-primary">{log.action}</span> em <span className="font-mono">{log.table_name}</span>
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "HH:mm:ss · dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          Ator: {log.actor_id?.slice(0,8) || 'Sistema'}
                        </p>
                        {log.metadata && (
                          <div className="mt-2 text-[10px] font-mono p-2 bg-black/20 rounded border border-white/5 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
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
    </div>
  );
};

export default AutomationMonitoring;
