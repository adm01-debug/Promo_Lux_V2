import { FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { markEmailTemplateUsed, useEmailTemplates } from "@/hooks/useEmailTemplates";
import type { SequenceStep } from "./CampaignFormFields";

type Props = {
  onApply: (sequence: SequenceStep[]) => void;
};

/**
 * Aplica um template da biblioteca na sequencia da campanha.
 * Template sem `sequence` vira uma unica etapa de e-mail com subject/body.
 */
export function EmailTemplatePicker({ onApply }: Props) {
  const { data: templates } = useEmailTemplates();

  if (!templates || templates.length === 0) return null;

  const apply = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const steps: SequenceStep[] = t.sequence && t.sequence.length > 0
      ? t.sequence.map((s, i) => ({ ...s, id: s.id || `t${Date.now()}-${i}` }))
      : [{ id: `t${Date.now()}`, type: "email", label: t.name, subject: t.subject ?? "", body: t.body ?? "" }];
    onApply(steps);
    void markEmailTemplateUsed(t.id);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" /> Usar template da biblioteca
      </Label>
      <Select onValueChange={apply}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="Escolha um template salvo" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              {t.name} · {t.usage_count} usos
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}