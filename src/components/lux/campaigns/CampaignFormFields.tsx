import { Plus, Trash2, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Uma variante A/B do primeiro e-mail (assunto/corpo alternativos).
export type SequenceVariant = { label?: string; subject?: string; body?: string };

// Etapa da sequência: e-mail (com assunto/corpo e opcionalmente variantes A/B)
// ou espera (delay). Mantém compatibilidade com sequências antigas (só label).
export type SequenceStep = {
  id: string;
  type: string;
  label: string;
  subject?: string;
  body?: string;
  variants?: SequenceVariant[];
};

export type AbConfig = {
  enabled: boolean;
  minSample: number;
  metric: "open" | "click" | "reply";
};

interface CampaignFormFieldsProps {
  name: string;
  setName: (v: string) => void;
  prospects: string;
  setProspects: (v: string) => void;
  sequence: SequenceStep[];
  setSequence: (v: SequenceStep[]) => void;
  ab: AbConfig;
  setAb: (v: AbConfig) => void;
  isEdit?: boolean;
}

// Índice da primeira etapa de e-mail (única elegível para teste A/B no motor).
function firstEmailIndex(sequence: SequenceStep[]): number {
  return sequence.findIndex((s) => s.type === "email");
}

export const CampaignFormFields = ({
  name, setName, prospects, setProspects, sequence, setSequence, ab, setAb,
}: CampaignFormFieldsProps) => {
  const abIdx = firstEmailIndex(sequence);

  const patchStep = (idx: number, patch: Partial<SequenceStep>) => {
    const updated = [...sequence];
    updated[idx] = { ...updated[idx], ...patch };
    setSequence(updated);
  };

  const addVariant = (idx: number) => {
    const step = sequence[idx];
    const base: SequenceVariant = { subject: step.subject, body: step.body };
    const variants = step.variants && step.variants.length > 0 ? step.variants : [base];
    patchStep(idx, { variants: [...variants, { subject: "", body: "" }] });
  };

  const patchVariant = (idx: number, vIdx: number, patch: Partial<SequenceVariant>) => {
    const step = sequence[idx];
    const variants = [...(step.variants ?? [])];
    variants[vIdx] = { ...variants[vIdx], ...patch };
    patchStep(idx, { variants });
  };

  const removeVariant = (idx: number, vIdx: number) => {
    const step = sequence[idx];
    const variants = (step.variants ?? []).filter((_, i) => i !== vIdx);
    patchStep(idx, { variants: variants.length > 1 ? variants : undefined });
  };

  return (
    <div className="space-y-4 mt-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Nome da Campanha</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Outreach SaaS Q2" className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Nº de Prospects</Label>
        <Input value={prospects} onChange={(e) => setProspects(e.target.value)} type="number" className="h-9 text-sm" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sequência</Label>
        <div className="space-y-3">
          {sequence.map((step, idx) => (
            <div key={step.id} className="glass rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {step.type === "email" ? "📧" : "⏳"} {idx + 1}
                </Badge>
                <Input
                  value={step.label}
                  onChange={(e) => patchStep(idx, { label: e.target.value })}
                  className="h-8 text-xs"
                />
                {sequence.length > 1 && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                    onClick={() => setSequence(sequence.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {step.type === "email" && (!step.variants || step.variants.length <= 1) && (
                <div className="space-y-2">
                  <Input
                    value={step.subject ?? ""}
                    onChange={(e) => patchStep(idx, { subject: e.target.value })}
                    placeholder="Assunto (use {{nome}})"
                    className="h-8 text-xs"
                  />
                  <Textarea
                    value={step.body ?? ""}
                    onChange={(e) => patchStep(idx, { body: e.target.value })}
                    placeholder="Corpo do e-mail (use {{nome}}, {{email}})"
                    className="text-xs min-h-[70px]"
                  />
                </div>
              )}

              {/* Variantes A/B — apenas na primeira etapa de e-mail. */}
              {step.type === "email" && idx === abIdx && step.variants && step.variants.length > 1 && (
                <div className="space-y-2">
                  {step.variants.map((v, vIdx) => (
                    <div key={vIdx} className="rounded-md border border-border/50 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-primary">
                          Variante {String.fromCharCode(65 + vIdx)}
                        </span>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeVariant(idx, vIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={v.subject ?? ""}
                        onChange={(e) => patchVariant(idx, vIdx, { subject: e.target.value })}
                        placeholder="Assunto"
                        className="h-8 text-xs"
                      />
                      <Textarea
                        value={v.body ?? ""}
                        onChange={(e) => patchVariant(idx, vIdx, { body: e.target.value })}
                        placeholder="Corpo"
                        className="text-xs min-h-[60px]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {step.type === "email" && idx === abIdx && (
                <Button
                  variant="outline" size="sm" className="text-xs h-7 gap-1"
                  onClick={() => addVariant(idx)}
                >
                  <FlaskConical className="h-3 w-3" /> Adicionar variante A/B
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline" size="sm" className="text-xs h-7 gap-1"
            onClick={() => setSequence([...sequence, { id: `s${Date.now()}`, type: "email", label: "Novo email" }])}
          >
            <Plus className="h-3 w-3" /> Email
          </Button>
          <Button
            variant="outline" size="sm" className="text-xs h-7 gap-1"
            onClick={() => setSequence([...sequence, { id: `s${Date.now()}`, type: "wait", label: "Aguardar 3 dias" }])}
          >
            <Plus className="h-3 w-3" /> Espera
          </Button>
        </div>
      </div>

      {/* Configuração do teste A/B automático. */}
      <div className="glass rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-foreground flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-primary" /> Vencedor A/B automático
          </Label>
          <Switch checked={ab.enabled} onCheckedChange={(v) => setAb({ ...ab, enabled: v })} />
        </div>
        {ab.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Amostra mín. por variante</Label>
              <Input
                type="number" min={1}
                value={ab.minSample}
                onChange={(e) => setAb({ ...ab, minSample: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Métrica de decisão</Label>
              <Select value={ab.metric} onValueChange={(v) => setAb({ ...ab, metric: v as AbConfig["metric"] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply">Respostas</SelectItem>
                  <SelectItem value="open">Aberturas</SelectItem>
                  <SelectItem value="click">Cliques</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Quando cada variante atingir a amostra mínima, o sistema elege a vencedora e envia o restante da base com ela.
        </p>
      </div>
    </div>
  );
};
