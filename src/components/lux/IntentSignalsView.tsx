import { useState } from "react";
import { Radar, TrendingUp, Eye, Globe, Briefcase, Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

type SignalType = "website_visit" | "hiring" | "funding" | "tech_adoption" | "content_engagement";

const signalConfig: Record<SignalType, { label: string; icon: React.ReactNode; color: string }> = {
  website_visit: { label: "Visita ao Site", icon: <Eye className="h-3.5 w-3.5" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  hiring: { label: "Contratando", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  funding: { label: "Rodada de Investimento", icon: <TrendingUp className="h-3.5 w-3.5" />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  tech_adoption: { label: "Adoção de Tech", icon: <Globe className="h-3.5 w-3.5" />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  content_engagement: { label: "Engajamento", icon: <Eye className="h-3.5 w-3.5" />, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

const strengthColors: Record<string, string> = {
  high: "bg-success/20 text-success border-success/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
};

export const IntentSignalsView = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSignal, setEditingSignal] = useState<any>(null);
  const [companyName, setCompanyName] = useState("");
  const [type, setType] = useState<SignalType>("website_visit");
  const [signal, setSignal] = useState("");
  const [strength, setStrength] = useState("medium");
  const [details, setDetails] = useState("");

  const resetForm = () => {
    setCompanyName(""); setType("website_visit"); setSignal(""); setStrength("medium"); setDetails("");
  };

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ["intent-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intent_signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("intent_signals").insert({
        company_name: companyName.trim(),
        type,
        signal: signal.trim(),
        strength,
        details: details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intent-signals"] });
      toast({ title: "Sinal registrado!" });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingSignal) return;
      const { error } = await supabase.from("intent_signals").update({
        company_name: companyName.trim(),
        type,
        signal: signal.trim(),
        strength,
        details: details.trim() || null,
      }).eq("id", editingSignal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intent-signals"] });
      toast({ title: "Sinal atualizado!" });
      setEditOpen(false);
      setEditingSignal(null);
      resetForm();
    },
    onError: (err) => toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intent_signals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intent-signals"] });
      toast({ title: "Sinal removido" });
    },
  });

  const openEdit = (s: any) => {
    setEditingSignal(s);
    setCompanyName(s.company_name);
    setType(s.type as SignalType);
    setSignal(s.signal);
    setStrength(s.strength);
    setDetails(s.details || "");
    setEditOpen(true);
  };

  const highCount = signals.filter((s: any) => s.strength === "high").length;
  const medCount = signals.filter((s: any) => s.strength === "medium").length;
  const lowCount = signals.filter((s: any) => s.strength === "low").length;

  const FormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Empresa</Label>
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa" className="h-9 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as SignalType)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(signalConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Intensidade</Label>
          <Select value={strength} onValueChange={setStrength}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">🔥 Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sinal</Label>
        <Input value={signal} onChange={(e) => setSignal(e.target.value)} placeholder="Ex: Visitou página de pricing 3x" className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Detalhes (opcional)</Label>
        <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Contexto adicional" className="h-9 text-sm" />
      </div>
      {isEdit ? (
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !companyName.trim() || !signal.trim()} className="w-full gap-2">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      ) : (
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !companyName.trim() || !signal.trim()} className="w-full gap-2">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          Registrar Sinal
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Sinais de Intenção de Compra
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore sinais que indicam propensão de compra — {signals.length} sinais registrados
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Registrar Sinal</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-primary" /> Novo Sinal de Intenção
              </DialogTitle>
            </DialogHeader>
            <FormFields />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingSignal(null); resetForm(); } }}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Sinal
            </DialogTitle>
          </DialogHeader>
          <FormFields isEdit />
        </DialogContent>
      </Dialog>

      {/* Strength summary */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: "high", count: highCount, label: "Alta Intenção" },
          { key: "medium", count: medCount, label: "Média Intenção" },
          { key: "low", count: lowCount, label: "Baixa Intenção" },
        ] as const).map(({ key, count, label }) => (
          <div key={key} className="glass rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
              <Badge variant="outline" className={`text-xs ${strengthColors[key]}`}>{count}</Badge>
            </div>
            <p className="text-2xl font-bold font-mono text-foreground mt-2">{count}</p>
            <p className="text-xs text-muted-foreground">sinais detectados</p>
          </div>
        ))}
      </div>

      {/* Signals list */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-foreground text-sm">Feed de Sinais</h3>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : signals.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Nenhum sinal registrado"
            description="Sinais de intenção aparecerão aqui. Clique em 'Registrar Sinal' para adicionar manualmente."
          />
        ) : (
          <div className="divide-y divide-border/20">
            {signals.map((sig: any, i: number) => {
              const config = signalConfig[sig.type as SignalType] || signalConfig.website_visit;
              return (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 hover:bg-secondary/20 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${config.color} flex-shrink-0 mt-0.5`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{sig.company_name}</span>
                          <Badge variant="outline" className={`text-[10px] ${strengthColors[sig.strength] || strengthColors.medium}`}>
                            {sig.strength === "high" ? "🔥 Alta" : sig.strength === "medium" ? "Média" : "Baixa"}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{sig.signal}</p>
                        {sig.details && <p className="text-xs text-muted-foreground mt-1">{sig.details}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {(() => {
                            try { return formatDistanceToNow(new Date(sig.created_at), { addSuffix: true, locale: ptBR }); }
                            catch { return sig.created_at; }
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(sig)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(sig.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};