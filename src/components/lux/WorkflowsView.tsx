import { db } from "@/integrations/supabase/withOrg";
import { useState } from "react";
import { ViewSkeleton } from "@/components/lux/ViewSkeleton";
import { DataError } from "@/components/lux/DataError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StepProgress } from "@/components/lux/StepProgress";
import {
  Plus, ArrowRight, Globe, Zap, Loader2, MapPin, Database, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { workflowApi, type Workflow } from "@/lib/api/workflows";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_WORKFLOWS } from "@/lib/demoData";
import { toast } from "@/hooks/use-toast";
import { WorkflowCard } from "./workflows/WorkflowCard";
import { useCan } from "@/hooks/usePermissions";

const stepColors: Record<string, string> = {
  source: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enrich: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  filter: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  action: "bg-green-500/20 text-green-400 border-green-500/30",
};

const stepIcons: Record<string, React.ReactNode> = {
  source: <Globe className="h-3.5 w-3.5" />,
  enrich: <Database className="h-3.5 w-3.5" />,
  filter: <Filter className="h-3.5 w-3.5" />,
  action: <Database className="h-3.5 w-3.5" />,
};

const defaultSteps = [
  { id: "s1", type: "source" as const, label: "Google Maps Scraper", provider: "gmaps.atomicabr" },
  { id: "s2", type: "enrich" as const, label: "Importar & Enriquecer", provider: "Waterfall" },
  { id: "s3", type: "filter" as const, label: "Scoring IPC", provider: "LUX IA" },
  { id: "s4", type: "action" as const, label: "Salvar no Banco", provider: "Lovable Cloud" },
];

export const WorkflowsView = () => {
  const { isDemoMode } = useDemo();
  const canCreate = useCan("workflows", "create");
  const canEdit = useCan("workflows", "edit");
  const canDelete = useCan("workflows", "delete");
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("Google Maps → Enriquecimento → IPC");
  const [newDescription, setNewDescription] = useState("Raspa empresas, enriquece dados de contato e qualifica pelo IPC automaticamente");
  const [keywords, setKeywords] = useState("restaurantes, bares");
  const [radius, setRadius] = useState(10000);
  const [extractEmail, setExtractEmail] = useState(true);

  const { data: workflows = [], isLoading, error: workflowsError, refetch } = useQuery({
    queryKey: ["workflows"],
    queryFn: isDemoMode
      ? () => DEMO_WORKFLOWS as unknown as Workflow[]
      : async () => {
          try { return await workflowApi.list(); } catch {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data, error } = await db.from("workflows").select("*, workflow_runs(id, status, started_at, completed_at, results)").order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as unknown as Workflow[];
          }
        },
    refetchInterval: 15000,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Parameters<typeof workflowApi.create>[0]) => {
      try { return await workflowApi.create(data); } catch {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: row, error } = await db.from("workflows").insert({ name: data.name, description: data.description, status: "active", steps: data.steps as unknown as Json, config: data.config as unknown as Json }).select().single();
        if (error) throw error;
        return row as unknown as Workflow;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workflows"] }); toast({ title: "Workflow criado!" }); setCreateOpen(false); },
    onError: (err) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
  });

  const runMutation = useMutation({
    mutationFn: workflowApi.run,
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ["workflows"] }); const s = result.results?.summary; toast({ title: "Workflow executado!", description: s ? `${s.total_companies} processadas, ${s.qualified} qualificadas` : "Concluído." }); },
    onError: (err) => { toast({ title: "Erro ao executar", description: err.message, variant: "destructive" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      try { await workflowApi.toggleStatus(id, status); } catch {
        const { supabase } = await import("@/integrations/supabase/client");
        const { error } = await db.from("workflows").update({ status: status as Tables<"workflows">["status"] }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workflows"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try { await workflowApi.delete(id); } catch {
        const { supabase } = await import("@/integrations/supabase/client");
        const { error } = await db.from("workflows").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workflows"] }); toast({ title: "Workflow removido" }); },
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), description: newDescription.trim(), steps: defaultSteps, config: { keywords: keywords.split(",").map(k => k.trim()).filter(Boolean), radius, email: extractEmail, depth: 1, lang: "pt" } });
  };

  const activeCount = workflows.filter(w => w.status === "active").length;
  const totalProcessed = workflows.reduce((a, w) => a + (w.leads_processed || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflows de Automação</h2>
          <p className="text-sm text-muted-foreground mt-1">{activeCount} ativos — {totalProcessed.toLocaleString()} leads processados</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          {canCreate && <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo Workflow</Button></DialogTrigger>}
          <DialogContent className="bg-card border-border/50">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Novo Workflow Automático</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <StepProgress steps={defaultSteps.map(s => s.label)} currentStep={createMutation.isPending ? defaultSteps.length : 0} className="py-2" />
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {defaultSteps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={cn("rounded-md border px-2 py-1.5 flex items-center gap-1.5 whitespace-nowrap", stepColors[step.type])}>
                      {stepIcons[step.type]}<span className="text-[10px] font-medium">{step.label}</span>
                    </div>
                    {i < defaultSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">Nome</Label><Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm" /></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">Descrição</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} className="h-9 text-sm" /></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">Keywords (Google Maps)</Label><Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="restaurantes, bares, hotéis" className="h-9 text-sm" /></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">Raio: {(radius / 1000).toFixed(0)}km</Label><Slider value={[radius]} onValueChange={([v]) => setRadius(v)} min={1000} max={50000} step={1000} /></div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Extrair emails</p><p className="text-[10px] text-muted-foreground">Busca emails nos sites encontrados</p></div>
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

      {workflowsError ? (
        <DataError message={workflowsError.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ViewSkeleton />
      ) : workflows.length === 0 ? (
        <div className="glass rounded-lg p-8 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-primary/30" />
          <p className="text-sm text-muted-foreground">Nenhum workflow criado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf, i) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              index={i}
              isExpanded={expandedId === wf.id}
              isRunning={runMutation.isPending}
              onToggleExpand={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
              onRun={(id) => runMutation.mutate(id)}
              onToggleStatus={(id, status) => toggleMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
