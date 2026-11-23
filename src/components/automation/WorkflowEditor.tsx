import { useState, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, Clock, GitBranch, Bell, Webhook, Tag, Globe, Database, Filter, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StepType =
  | "email"
  | "wait"
  | "condition"
  | "notify"
  | "webhook"
  | "tag"
  | "scrape"
  | "enrich"
  | "filter";

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
  phase?: string;
}

export interface WorkflowEditorProps {
  initialSteps?: WorkflowStep[];
  onSave?: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
  saving?: boolean;
  className?: string;
}

const STEP_META: Record<StepType, { icon: React.ReactNode; label: string; color: string; phase?: string }> = {
  scrape:    { icon: <Globe className="h-3.5 w-3.5" />,    label: "Coletar",         color: "bg-blue-500/20 text-blue-400 border-blue-500/30",     phase: "scrape" },
  enrich:    { icon: <Database className="h-3.5 w-3.5" />, label: "Enriquecer",      color: "bg-purple-500/20 text-purple-400 border-purple-500/30", phase: "enrich" },
  filter:    { icon: <Filter className="h-3.5 w-3.5" />,   label: "Filtrar",         color: "bg-amber-500/20 text-amber-400 border-amber-500/30",   phase: "ipc_score" },
  email:     { icon: <Mail className="h-3.5 w-3.5" />,     label: "Enviar Email",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
  wait:      { icon: <Clock className="h-3.5 w-3.5" />,    label: "Aguardar",        color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  condition: { icon: <GitBranch className="h-3.5 w-3.5" />,label: "Condição",        color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  notify:    { icon: <Bell className="h-3.5 w-3.5" />,     label: "Notificar",       color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  webhook:   { icon: <Webhook className="h-3.5 w-3.5" />,  label: "Webhook",         color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  tag:       { icon: <Tag className="h-3.5 w-3.5" />,      label: "Adicionar Tag",   color: "bg-lime-500/20 text-lime-400 border-lime-500/30" },
};

function ConfigFields({ step, onChange }: { step: WorkflowStep; onChange: (patch: Partial<WorkflowStep["config"]>) => void }) {
  const cfg = step.config;

  if (step.type === "scrape") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px] text-muted-foreground">Keywords (vírgula)</Label>
          <Input value={(cfg.keywords as string) ?? ""} onChange={e => onChange({ keywords: e.target.value })} className="h-7 text-xs" placeholder="restaurantes, bares" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Raio (m)</Label>
          <Input type="number" value={(cfg.radius as number) ?? 10000} onChange={e => onChange({ radius: parseInt(e.target.value) || 10000 })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Profundidade</Label>
          <Input type="number" min={1} max={3} value={(cfg.depth as number) ?? 1} onChange={e => onChange({ depth: parseInt(e.target.value) || 1 })} className="h-7 text-xs" />
        </div>
      </div>
    );
  }

  if (step.type === "email") {
    return (
      <div className="space-y-2">
        <Input value={(cfg.subject as string) ?? ""} onChange={e => onChange({ subject: e.target.value })} placeholder="Assunto" className="h-7 text-xs" />
        <Textarea value={(cfg.body as string) ?? ""} onChange={e => onChange({ body: e.target.value })} placeholder="Corpo (use {{nome}}, {{empresa}})" className="text-xs min-h-[60px]" />
      </div>
    );
  }

  if (step.type === "wait") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Duração</Label>
          <Input type="number" min={1} value={(cfg.amount as number) ?? 3} onChange={e => onChange({ amount: parseInt(e.target.value) || 1 })} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Unidade</Label>
          <Select value={(cfg.unit as string) ?? "days"} onValueChange={v => onChange({ unit: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
              <SelectItem value="weeks">Semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (step.type === "condition") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px] text-muted-foreground">Campo</Label>
          <Select value={(cfg.field as string) ?? "ipc_score"} onValueChange={v => onChange({ field: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ipc_score">IPC Score</SelectItem>
              <SelectItem value="email_verified">Email verificado</SelectItem>
              <SelectItem value="sector">Setor</SelectItem>
              <SelectItem value="employee_count">Funcionários</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Operador</Label>
          <Select value={(cfg.operator as string) ?? "gte"} onValueChange={v => onChange({ operator: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gte">≥</SelectItem>
              <SelectItem value="lte">≤</SelectItem>
              <SelectItem value="eq">==</SelectItem>
              <SelectItem value="contains">contém</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Valor</Label>
          <Input value={(cfg.value as string) ?? ""} onChange={e => onChange({ value: e.target.value })} className="h-7 text-xs" />
        </div>
      </div>
    );
  }

  if (step.type === "webhook") {
    return (
      <div className="space-y-2">
        <Input value={(cfg.url as string) ?? ""} onChange={e => onChange({ url: e.target.value })} placeholder="https://hooks.example.com/..." className="h-7 text-xs" />
        <Select value={(cfg.method as string) ?? "POST"} onValueChange={v => onChange({ method: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (step.type === "notify") {
    return (
      <Input value={(cfg.message as string) ?? ""} onChange={e => onChange({ message: e.target.value })} placeholder="Mensagem da notificação" className="h-7 text-xs" />
    );
  }

  if (step.type === "tag") {
    return (
      <Input value={(cfg.tag as string) ?? ""} onChange={e => onChange({ tag: e.target.value })} placeholder="nome-da-tag" className="h-7 text-xs" />
    );
  }

  return null;
}

function defaultConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case "scrape":    return { keywords: "restaurantes", radius: 10000, depth: 1 };
    case "email":     return { subject: "", body: "" };
    case "wait":      return { amount: 3, unit: "days" };
    case "condition": return { field: "ipc_score", operator: "gte", value: "50" };
    case "webhook":   return { url: "", method: "POST" };
    case "notify":    return { message: "" };
    case "tag":       return { tag: "" };
    default:          return {};
  }
}

export function WorkflowEditor({ initialSteps = [], onSave, readOnly = false, saving = false, className }: WorkflowEditorProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addStep = useCallback((type: StepType) => {
    const meta = STEP_META[type];
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type,
      label: meta.label,
      config: defaultConfig(type),
      ...(meta.phase ? { phase: meta.phase } : {}),
    };
    setSteps(prev => [...prev, newStep]);
    setExpandedId(newStep.id);
  }, []);

  const updateStep = useCallback((id: string, patch: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const updateConfig = useCallback((id: string, patch: Partial<WorkflowStep["config"]>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const moveStep = useCallback((id: string, dir: -1 | 1) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {steps.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground">
          Nenhum passo configurado. Adicione etapas abaixo.
        </div>
      )}

      <div className="space-y-2">
        {steps.map((step, idx) => {
          const meta = STEP_META[step.type];
          const isExpanded = expandedId === step.id;
          return (
            <div key={step.id} className={cn("rounded-md border p-2.5", meta.color, "bg-opacity-10")}>
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium border flex items-center gap-1 shrink-0", meta.color)}>
                  {meta.icon}{idx + 1}
                </span>
                <Input
                  value={step.label}
                  onChange={e => updateStep(step.id, { label: e.target.value })}
                  disabled={readOnly}
                  className="h-7 text-xs flex-1 bg-background/60"
                />
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpandedId(isExpanded ? null : step.id)}>
                      <span className="text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === 0} onClick={() => moveStep(step.id, -1)}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === steps.length - 1} onClick={() => moveStep(step.id, 1)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeStep(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {isExpanded && !readOnly && (
                <div className="mt-2 pl-1">
                  <ConfigFields step={step} onChange={patch => updateConfig(step.id, patch)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Adicionar etapa</Label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STEP_META) as StepType[]).map(type => {
              const m = STEP_META[type];
              return (
                <Button key={type} variant="outline" size="sm" className={cn("text-xs h-7 gap-1 border", m.color)} onClick={() => addStep(type)}>
                  {m.icon}{m.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {onSave && !readOnly && (
        <Button onClick={() => onSave(steps)} disabled={saving || steps.length === 0} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Workflow"}
        </Button>
      )}
    </div>
  );
}
