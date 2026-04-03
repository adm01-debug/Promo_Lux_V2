import { useState, useEffect } from "react";
import { Target, Plus, Trash2, Save, Sliders, Building2, MapPin, Users, DollarSign, Globe, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useICPConfig, type ICPCriterion } from "@/hooks/useICPConfig";

const iconMap: Record<string, React.ReactNode> = {
  sector: <Building2 className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  employees: <Users className="h-4 w-4" />,
  revenue: <DollarSign className="h-4 w-4" />,
  online_presence: <Globe className="h-4 w-4" />,
};

export const ICPConfigView = () => {
  const { config, isLoading, save, isSaving } = useICPConfig();
  const [criteria, setCriteria] = useState<ICPCriterion[]>([]);
  const [newTag, setNewTag] = useState("");
  const [activeAutoSearch, setActiveAutoSearch] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Sync from DB when loaded
  useEffect(() => {
    if (config?.criteria) {
      setCriteria(config.criteria);
      setDirty(false);
    }
  }, [config]);

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
        c.id === criteriaId ? { ...c, value: c.value.filter((t: string) => t !== tag) } : c
      )
    );
  };

  const addTag = (criteriaId: string) => {
    if (!newTag.trim()) return;
    updateCriteria((prev) =>
      prev.map((c) =>
        c.id === criteriaId ? { ...c, value: [...c.value, newTag.trim()] } : c
      )
    );
    setNewTag("");
  };

  const updateWeight = (criteriaId: string, weight: number) => {
    updateCriteria((prev) =>
      prev.map((c) => (c.id === criteriaId ? { ...c, weight } : c))
    );
  };

  const handleSave = () => {
    save({
      id: config?.id || "",
      name: config?.name || "default",
      criteria,
    });
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Configuração do IPC
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina os critérios do Índice de Potencial Comercial para filtrar empresas ideais
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass rounded-lg px-4 py-2">
            <span className="text-sm text-muted-foreground">Auto-busca</span>
            <Switch checked={activeAutoSearch} onCheckedChange={setActiveAutoSearch} />
          </div>
          <Button className="gap-2" onClick={handleSave} disabled={isSaving || !dirty}>
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

      {/* Score Preview */}
      <div className="glass rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Preview do Score IPC</h3>
            <p className="text-xs text-muted-foreground">
              Inspirado nos modelos de Lead Scoring do Apollo.io — pesos configuráveis por critério
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono text-primary">
              {criteria.length > 0 ? Math.round(criteria.reduce((a, c) => a + c.weight, 0) / criteria.length) : 0}
            </p>
            <p className="text-xs text-muted-foreground">Score médio</p>
          </div>
        </div>
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-secondary">
          {criteria.map((c) => (
            <div
              key={c.id}
              className="bg-primary/80 rounded-full transition-all"
              style={{ width: `${c.weight / criteria.length}%` }}
            />
          ))}
        </div>
      </div>

      {/* Criteria Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {criteria.map((c) => (
          <div key={c.id} className="glass rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  {iconMap[c.id] || <Sliders className="h-4 w-4" />}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-foreground">{c.label}</h4>
                  <p className="text-xs text-muted-foreground">Peso: {c.weight}%</p>
                </div>
              </div>
              <Sliders className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Weight slider */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Importância no Score</Label>
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
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {c.value.map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-secondary/50 text-xs gap-1 cursor-pointer hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 transition-colors"
                      onClick={() => removeTag(c.id, tag)}
                    >
                      {tag}
                      <Trash2 className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar critério..."
                    className="h-8 text-xs"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag(c.id)}
                  />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => addTag(c.id)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Range */}
            {c.type === "range" && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1">
                  <Label className="text-muted-foreground">Mínimo</Label>
                  <Input
                    className="h-8 text-xs mt-1 font-mono"
                    defaultValue={c.value[0]?.toLocaleString("pt-BR")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      updateCriteria((prev) =>
                        prev.map((cr) => cr.id === c.id ? { ...cr, value: [val, cr.value[1]] } : cr)
                      );
                    }}
                  />
                </div>
                <span className="text-muted-foreground mt-5">—</span>
                <div className="flex-1">
                  <Label className="text-muted-foreground">Máximo</Label>
                  <Input
                    className="h-8 text-xs mt-1 font-mono"
                    defaultValue={c.value[1]?.toLocaleString("pt-BR")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      updateCriteria((prev) =>
                        prev.map((cr) => cr.id === c.id ? { ...cr, value: [cr.value[0], val] } : cr)
                      );
                    }}
                  />
                </div>
              </div>
            )}

            {/* Select */}
            {c.type === "select" && (
              <Select
                defaultValue={c.value}
                onValueChange={(val) => {
                  updateCriteria((prev) =>
                    prev.map((cr) => cr.id === c.id ? { ...cr, value: val } : cr)
                  );
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strong">Forte (site + redes sociais)</SelectItem>
                  <SelectItem value="medium">Média (apenas site)</SelectItem>
                  <SelectItem value="any">Qualquer</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
