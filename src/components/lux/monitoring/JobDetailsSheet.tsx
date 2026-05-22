import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface JobDetailsSheetProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JobDetailsSheet = ({ jobId, open, onOpenChange }: JobDetailsSheetProps) => {
  const { data: job } = useQuery({
    queryKey: ["scrape-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await db.from("scrape_jobs").select("*").eq("id", jobId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId && open,
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["scrape-results", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await db
        .from("scrape_results")
        .select("*, companies(*)")
        .eq("job_id", jobId)
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-border/50">
        <SheetHeader className="shrink-0">
          <div className="flex items-center gap-2 mb-2">
            {job?.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-success" />}
            {job?.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
            {(job?.status === 'running' || job?.status === 'working') && <Clock className="h-5 w-5 text-primary animate-spin" />}
            <SheetTitle>{job?.name || "Detalhes da Execução"}</SheetTitle>
          </div>
          <SheetDescription>
            Logs e resultados detalhados da automação.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Status</p>
              <Badge variant={job?.status === 'completed' ? 'default' : job?.status === 'failed' ? 'destructive' : 'secondary'}>
                {job?.status}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Empresas</p>
              <div className="flex items-center gap-1.5 font-medium">
                <Building2 className="h-4 w-4 text-primary" />
                {job?.results_count || 0} processadas
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Empresas Encontradas</h3>
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {resultsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 w-full bg-muted/50 rounded-lg animate-pulse" />
                  ))
                ) : results && results.length > 0 ? (
                  results.map((res: any) => (
                    <div key={res.id} className="p-3 rounded-lg border border-border/50 bg-secondary/10 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-secondary/80 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary/70" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{res.companies?.name || "Empresa Desconhecida"}</p>
                          <p className="text-[10px] text-muted-foreground">{res.companies?.sector || "Sem setor"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {(res.raw_data as any)?.ipc_score || res.companies?.ipc_score || 0}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Building2 className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">Nenhum resultado processado ainda.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {job?.error_message && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mt-auto">
              <h4 className="text-xs font-bold text-destructive flex items-center gap-2 mb-2">
                <XCircle className="h-3 w-3" />
                RELATÓRIO DE ERRO
              </h4>
              <p className="text-[11px] font-mono text-destructive/90 whitespace-pre-wrap">
                {job.error_message}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
