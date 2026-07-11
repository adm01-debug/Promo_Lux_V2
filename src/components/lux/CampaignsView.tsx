import { useState, useEffect } from "react";
import { validateCampaign } from "@/lib/schemas/campaign";
import { useDemo } from "@/contexts/DemoContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { DEMO_CAMPAIGNS } from "@/lib/demoData";
import { Mail, Plus, Play, Pause, BarChart3, Users, Clock, Trash2, Loader2, CheckCircle2, Pencil, Activity } from "lucide-react";
import { CampaignTrackingDrawer } from "@/components/lux/campaigns/CampaignTrackingDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { DataError } from "@/components/lux/DataError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/usePermissions";
import type { Tables } from "@/integrations/supabase/types";
import { motion } from "framer-motion";

type CampaignStatus = "active" | "paused" | "draft" | "completed";

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Ativa", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausada", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground border-border", icon: <Clock className="h-3 w-3" /> },
  completed: { label: "Concluída", color: "bg-primary/20 text-primary border-primary/30", icon: <CheckCircle2 className="h-3 w-3" /> },
};

import { CampaignFormFields, type SequenceStep, type AbConfig } from "@/components/lux/campaigns/CampaignFormFields";

const defaultSequence: SequenceStep[] = [
  { id: "s1", type: "email", label: "Email inicial" },
  { id: "s2", type: "wait", label: "Aguardar 3 dias" },
  { id: "s3", type: "email", label: "Follow-up" },
  { id: "s4", type: "wait", label: "Aguardar 5 dias" },
  { id: "s5", type: "email", label: "Último contato" },
];

const defaultAb: AbConfig = { enabled: false, minSample: 20, metric: "reply" };


export const CampaignsView = () => {
  const { isDemoMode } = useDemo();
  const { user } = useAuth();
  const canCreate = useCan("campaigns", "create");
  const canEdit = useCan("campaigns", "edit");
  const canDelete = useCan("campaigns", "delete");
  const queryClient = useQueryClient();
  const { setHasUnsavedChanges, confirmNavigation } = useUnsavedChanges();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Tables<"campaigns"> | null>(null);
  const [trackingCampaign, setTrackingCampaign] = useState<Tables<"campaigns"> | null>(null);

  const [formName, setFormName] = useState("");
  const [formProspects, setFormProspects] = useState("50");
  const [formSequence, setFormSequence] = useState<SequenceStep[]>(defaultSequence);
  const [formAb, setFormAb] = useState<AbConfig>(defaultAb);
  const [dirty, setDirty] = useState(false);

  const resetForm = () => {
    setFormName("");
    setFormProspects("50");
    setFormSequence([...defaultSequence]);
    setFormAb({ ...defaultAb });
    setDirty(false);
  };


  // Sync dirty flag with global guard while a form dialog is open
  useEffect(() => {
    setHasUnsavedChanges((createOpen || editOpen) && dirty);
    return () => setHasUnsavedChanges(false);
  }, [createOpen, editOpen, dirty, setHasUnsavedChanges]);

  const guardedCloseCreate = (next: boolean) => {
    if (!next && dirty) {
      confirmNavigation(() => { setDirty(false); setCreateOpen(false); resetForm(); });
      return;
    }
    setCreateOpen(next);
    if (!next) resetForm();
  };

  const guardedCloseEdit = (next: boolean) => {
    if (!next && dirty) {
      confirmNavigation(() => { setDirty(false); setEditOpen(false); setEditingCampaign(null); resetForm(); });
      return;
    }
    setEditOpen(next);
    if (!next) { setEditingCampaign(null); resetForm(); }
  };

  const { data: campaigns = [], isLoading, error: campaignsError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: isDemoMode
      ? () => DEMO_CAMPAIGNS as unknown as Tables<"campaigns">[]
      : async () => {
          const { data, error } = await supabase
            .from("campaigns")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
    refetchInterval: 15_000,
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = validateCampaign({ name: formName, prospects: parseInt(formProspects) || 0 });
      if (!result.success) {
        const msg = Object.values(result.errors)[0];
        throw new Error(msg);
      }
      const { error } = await db.from("campaigns").insert({
        user_id: user?.id,
        name: formName.trim(),
        prospects: parseInt(formProspects) || 50,
        status: "draft",
        sequence: formSequence,
        ab_test_enabled: formAb.enabled,
        ab_min_sample: formAb.minSample,
        ab_winner_metric: formAb.metric,
      });
      if (error) throw error;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha criada!" });
      setDirty(false);
      setCreateOpen(false);
      resetForm();
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCampaign) return;
      const { error } = await db.from("campaigns").update({
        name: formName.trim(),
        prospects: parseInt(formProspects) || 50,
        sequence: formSequence,
      }).eq("id", editingCampaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha atualizada!" });
      setDirty(false);
      setEditOpen(false);
      setEditingCampaign(null);
      resetForm();
    },
    onError: (err) => toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "paused" : "active";
      const { error } = await db.from("campaigns").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      const action = variables.status === "active" ? "pausada" : "ativada";
      toast({ title: `Campanha ${action}` });
    },
    onError: (err: Error) => toast({ title: "Erro ao alternar status", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha removida" });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke("campaign-dispatch", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      return data as { results?: Array<{ sent?: number; failed?: number; reason?: string }> };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      const r = data?.results?.[0];
      if (r?.reason && !r.sent) {
        toast({ title: "Nada enviado", description: r.reason === "no active email account for organization" ? "Conecte uma conta de e-mail nas Integrações." : "Sem destinatários pendentes." });
      } else {
        toast({ title: "Envio disparado", description: `${r?.sent ?? 0} enviados · ${r?.failed ?? 0} falhas` });
      }
    },
    onError: (err: Error) => toast({ title: "Erro no envio", description: err.message, variant: "destructive" }),
  });

  const openEdit = (campaign: Tables<"campaigns">) => {
    setEditingCampaign(campaign);
    setFormName(campaign.name);
    setFormProspects(String(campaign.prospects));
    const seq = Array.isArray(campaign.sequence) ? campaign.sequence as SequenceStep[] : defaultSequence;
    setFormSequence(seq);
    setDirty(false);
    setEditOpen(true);
  };

  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalSent = campaigns.reduce((a, c) => a + (c.sent || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Campanhas de Outreach
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} ativas — {totalSent} emails enviados
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={guardedCloseCreate}>
          {canCreate && (
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Campanha</Button>
            </DialogTrigger>
          )}
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> Nova Campanha
              </DialogTitle>
            </DialogHeader>
            <CampaignFormFields
              name={formName} setName={(v) => { setFormName(v); setDirty(true); }}
              prospects={formProspects} setProspects={(v) => { setFormProspects(v); setDirty(true); }}
              sequence={formSequence} setSequence={(v) => { setFormSequence(v); setDirty(true); }}
            />
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formName.trim()} className="w-full gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Criar Campanha
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={guardedCloseEdit}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Campanha
            </DialogTitle>
          </DialogHeader>
          <CampaignFormFields
            name={formName} setName={(v) => { setFormName(v); setDirty(true); }}
            prospects={formProspects} setProspects={(v) => { setFormProspects(v); setDirty(true); }}
            sequence={formSequence} setSequence={(v) => { setFormSequence(v); setDirty(true); }}
            isEdit
          />
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !formName.trim()} className="w-full gap-2">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </DialogContent>
      </Dialog>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Campanhas", value: campaigns.length, color: "text-foreground" },
          { label: "Ativas", value: activeCount, color: "text-success" },
          { label: "Enviados", value: totalSent, color: "text-primary" },
          { label: "Reuniões", value: campaigns.reduce((a, c) => a + (c.meetings || 0), 0), color: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            <p className={`text-xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      {campaignsError ? (
        <DataError message={campaignsError.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass rounded-lg overflow-hidden">
          <EmptyState
            icon={Mail}
            title="Nenhuma campanha criada"
            description="Crie sua primeira campanha de outreach para engajar prospects."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign, i) => {
            const status = statusConfig[(campaign.status as CampaignStatus) || "draft"] || statusConfig.draft;
            const openRate = campaign.sent > 0 ? Math.round((campaign.opened / campaign.sent) * 100) : 0;
            const replyRate = campaign.sent > 0 ? Math.round((campaign.replied / campaign.sent) * 100) : 0;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-lg p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm">{campaign.name}</h3>
                      <Badge variant="outline" className={`text-xs gap-1 ${status.color}`}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.prospects} prospects · Criada em {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-8"
                        onClick={() => openEdit(campaign)}
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8"
                      onClick={() => setTrackingCampaign(campaign)}
                    >
                      <Activity className="h-3 w-3" /> Tracking
                    </Button>
                    {canEdit && <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8"
                      onClick={() => toggleMutation.mutate({ id: campaign.id, status: campaign.status })}
                    >
                      {campaign.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {campaign.status === "active" ? "Pausar" : "Ativar"}
                    </Button>}
                    {canEdit && campaign.status === "active" && !isDemoMode && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 text-xs h-8"
                        onClick={() => dispatchMutation.mutate(campaign.id)}
                        disabled={dispatchMutation.isPending}
                      >
                        {dispatchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        Enviar agora
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-8"
                        onClick={() => deleteMutation.mutate(campaign.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Enviados", value: campaign.sent, icon: <Mail className="h-3 w-3" /> },
                    { label: "Abertos", value: `${openRate}%`, icon: <BarChart3 className="h-3 w-3" /> },
                    { label: "Respondidos", value: `${replyRate}%`, icon: <Users className="h-3 w-3" /> },
                    { label: "Reuniões", value: campaign.meetings, icon: <CheckCircle2 className="h-3 w-3" /> },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{m.icon}<span className="text-[10px]">{m.label}</span></div>
                      <p className="font-mono font-bold text-foreground">{m.value}</p>
                    </div>
                  ))}
                </div>

                {campaign.sent > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progresso de envio</span>
                      <span>{campaign.sent}/{campaign.prospects}</span>
                    </div>
                    <Progress value={(campaign.sent / campaign.prospects) * 100} className="h-1.5" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <CampaignTrackingDrawer
        campaignId={trackingCampaign?.id ?? null}
        campaignName={trackingCampaign?.name ?? ""}
        open={!!trackingCampaign}
        onOpenChange={(v) => { if (!v) setTrackingCampaign(null); }}
      />
    </div>
  );
};