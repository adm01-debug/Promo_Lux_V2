import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeals, type DealStage } from "@/hooks/useDeals";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stages: DealStage[];
  defaultStageId?: string | null;
}

export function AddDealDialog({ open, onOpenChange, stages, defaultStageId }: Props) {
  const { createDeal } = useDeals();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");

  const reset = () => {
    setTitle(""); setValue(""); setDescription(""); setPriority("medium");
    setStageId(defaultStageId ?? stages[0]?.id ?? "");
  };

  const submit = async () => {
    if (!title.trim() || !stageId) return;
    await createDeal.mutateAsync({
      title: title.trim(),
      stage_id: stageId,
      value: Number(value) || 0,
      priority,
      description: description.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Novo Negócio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do negócio" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Estágio</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || createDeal.isPending}>
            {createDeal.isPending ? "Criando..." : "Criar negócio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}