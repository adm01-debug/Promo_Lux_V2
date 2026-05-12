import { useState, useEffect } from "react";
import { Target, Plus, Trash2, Save, Sliders, Building2, MapPin, Users, DollarSign, Globe, Loader2, CheckCircle2, ChevronDown, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useICPConfig, type ICPCriterion } from "@/hooks/useICPConfig";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const iconMap: Record<string, React.ReactNode> = {
  sector: <Building2 className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  employees: <Users className="h-4 w-4" />,
  revenue: <DollarSign className="h-4 w-4" />,
  online_presence: <Globe className="h-4 w-4" />,
};

export const ICPConfigView = () => {
  const { configs, activeConfig, isLoading, save, isSaving, activate, delete: deleteConfig, DEFAULT_CRITERIA } = useICPConfig();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [criteria, setCriteria] = useState<ICPCriterion[]>([]);
  const [newTagName, setNewTagName] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [newConfigDialogOpen, setNewConfigDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");

  // Sync from activeConfig when it changes or loads
  useEffect(() => {
    if (activeConfig?.criteria) {
      setCriteria(activeConfig.criteria);
      setDirty(false);
    }
  }, [activeConfig]);

  useEffect(() => {
    setHasUnsavedChanges(dirty);
    return () => setHasUnsavedChanges(false);
  }, [dirty, setHasUnsavedChanges]);

  const updateCriteria = (updater: (prev: ICPCriterion[]) => ICPCriterion[]) => {
    setCriteria((prev) => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  };

  const removeTag = (criteriaId: string, tag: string) => {
    updateCriteria((prev) =>
      prev.map((c) =>
        c.id === criteriaId && Array.isArray(c.value)
          ? { ...c, value: (c.value as string[]).filter((t) => t !== tag) }
          : c
      )
    );
  };

  const addTag = (criteriaId: string) => {
    const val = newTagName[criteriaId]?.trim();
    if (!val) return;
    updateCriteria((prev) =>
      prev.map((c) =>
        c.id === criteriaId && Array.isArray(c.value)
          ? { ...c, value: [...(c.value as string[]), val] }
          : c
      )
    );
    setNewTagName(prev => ({ ...prev, [criteriaId]: "" }));
  };

  const updateWeight = (criteriaId: string, weight: number) => {
    updateCriteria((prev) =>
      prev.map((c) => (c.id === criteriaId ? { ...c, weight } : c))
    );
  };

  const handleSave = () => {
    if (!activeConfig) return;
    save({
      id: activeConfig.id,
      name: activeConfig.name,
      criteria,
    });
    setDirty(false);
  };

  const handleCreateConfig = () => {
    if (!newConfigName.trim()) return;
    save({
      name: newConfigName.trim(),
      criteria: DEFAULT_CRITERIA,
      is_active: true
    });
    setNewConfigName("");
    setNewConfigDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Configuração do IPC
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina perfis do Ideal Customer Profile para filtrar e pontuar empresas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Config Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 border-border/50 bg-secondary/30">
                <Settings2 className="h-4 w-4 text-primary" />
                {activeConfig?.name || "Selecionar Perfil"}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border/50">
              {configs.map(cfg => (
                <DropdownMenuItem 
                  key={cfg.id} 
                  className="flex items-center justify-between group"
                  onClick={() => activate(cfg.id)}
                >
                  <span className={cfg.is_active ? "text-primary font-bold" : ""}>{cfg.name}</span>
                  {cfg.is_active && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {!cfg.is_active && (
                    <button 
                      className="opacity-0 group-hover:opacity-100 text-destructive p-1 hover:bg-destructive/10 rounded"
                      onClick={(e) => { e.stopPropagation(); deleteConfig(cfg.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem 
                className="text-primary font-medium gap-2 border-t border-border/30 mt-1"
                onClick={() => setNewConfigDialogOpen(true)}
              >
                <Plus className="h-3 w-3" /> Novo Perfil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="gap-2 min-w-[120px]" onClick={handleSave} disabled={isSaving || !dirty}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dirty ? (
              <Save className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSaving ? "Salvando..." : dirty ? "Salvar IPC" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* New Config Dialog */}
      <Dialog open={newConfigDialogOpen} onOpenChange={setNewConfigDialogOpen}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Novo Perfil de IPC</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Nome do Perfil</Label>
            <Input 
              value={newConfigName} 
              onChange={e => setNewConfigName(e.target.value)}
              placeholder="Ex: Enterprise SaaS, Varejo Regional..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewConfigDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateConfig} disabled={!newConfigName.trim()}>Criar Perfil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Score Preview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Impacto no IPC Score
            </h3>
            <p className="text-xs text-muted-foreground">
              Pontuação dinâmica (0-100) baseada nos pesos definidos abaixo
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono text-primary">
              {criteria.length > 0 ? Math.round(criteria.reduce((a, c) => a + c.weight, 0) / criteria.length) : 0}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Peso Médio</p>
          </div>
        </div>
        <div className="flex gap-1.5 h-2.5 rounded-full overflow-hidden bg-secondary/50 p-0.5">
          {criteria.map((c) => (
            <motion.div
              key={c.id}
              initial={{ width: 0 }}
              animate={{ width: `${c.weight / criteria.length}%` }}
              className="bg-primary/80 rounded-full h-full shadow-[0_0_8px_rgba(212,165,32,0.4)]"
            />
          ))}
        </div>
      </motion.div>

      {/* Criteria Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {criteria.map((c, idx) => (
          <motion.div 
            key={c.id}
            initial={{ opacity: 0, x: idx % 2 === 0 ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass rounded-lg p-5 space-y-4 hover:border-primary/20 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                  {iconMap[c.id] || <Sliders className="h-4 w-4" />}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{c.label}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/30 text-primary">
                      Peso: {c.weight}%
                    </Badge>
                  </div>
                </div>
              </div>
              <Settings2 className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
            </div>

            {/* Weight slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Relevância no Cálculo</Label>
                <span className="text-[10px] font-mono text-primary font-bold">{c.weight}%</span>
              </div>
              <Slider
                value={[c.weight]}
                onValueChange={([v]) => updateWeight(c.id, v)}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Tags input */}
            {c.type === "tags" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                  {(c.value as string[]).map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-secondary/40 text-[11px] gap-1 pr-1.5 cursor-pointer hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 transition-all group/tag"
                      onClick={() => removeTag(c.id, tag)}
                    >
                      {tag}
                      <X className="h-3 w-3 opacity-50 group-hover/tag:opacity-100" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar critério..."
                    className="h-8 text-xs bg-secondary/20 border-border/40 focus:border-primary/50"
                    value={newTagName[c.id] || ""}
                    onChange={(e) => setNewTagName(prev => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addTag(c.id)}
                  />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => addTag(c.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Range */}
            {c.type === "range" && (
              <div className="flex items-center gap-3 text-xs pt-1">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase">Mínimo</Label>
                  <Input
                    className="h-8 text-xs font-mono bg-secondary/20 border-border/40"
                    defaultValue={(c.value as number[])[0]?.toLocaleString("pt-BR")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      updateCriteria((prev) =>
                        prev.map((cr) => cr.id === c.id ? { ...cr, value: [val, (cr.value as number[])[1]] } : cr)
                      );
                    }}
                  />
                </div>
                <div className="mt-5 h-[1px] w-4 bg-border/50" />
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase">Máximo</Label>
                  <Input
                    className="h-8 text-xs font-mono bg-secondary/20 border-border/40"
                    defaultValue={(c.value as number[])[1]?.toLocaleString("pt-BR")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      updateCriteria((prev) =>
                        prev.map((cr) => cr.id === c.id ? { ...cr, value: [(cr.value as number[])[0], val] } : cr)
                      );
                    }}
                  />
                </div>
              </div>
            )}

            {/* Select */}
            {c.type === "select" && (
              <div className="pt-1">
                <Label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">Nível Exigido</Label>
                <Select
                  defaultValue={c.value as string}
                  onValueChange={(val) => {
                    updateCriteria((prev) =>
                      prev.map((cr) => cr.id === c.id ? { ...cr, value: val } : cr)
                    );
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-secondary/20 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    <SelectItem value="strong">Forte (site + redes sociais)</SelectItem>
                    <SelectItem value="medium">Média (apenas site)</SelectItem>
                    <SelectItem value="any">Qualquer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

import { X } from "lucide-react";
