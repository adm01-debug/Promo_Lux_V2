import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { useDealStages } from "@/hooks/useDeals";
import { useConfirm } from "@/hooks/useConfirm";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function StagesManagerDialog({ open, onOpenChange }: Props) {
  const { data: stages = [], createStage, updateStage, deleteStage } = useDealStages();
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#D4A520");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg">
        <DialogHeader><DialogTitle>Estágios do Pipeline</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {stages.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/40">
              <input
                type="color" value={s.color}
                onChange={(e) => updateStage.mutate({ id: s.id, color: e.target.value })}
                className="h-8 w-8 rounded cursor-pointer bg-transparent border border-border/40"
              />
              <Input
                defaultValue={s.name}
                onBlur={(e) => e.target.value !== s.name && updateStage.mutate({ id: s.id, name: e.target.value })}
                className="flex-1 h-8"
              />
              <Input
                type="number" min={0} max={100} defaultValue={s.probability}
                onBlur={(e) => updateStage.mutate({ id: s.id, probability: Number(e.target.value) })}
                className="w-20 h-8"
                title="Probabilidade %"
              />
              <Button size="icon" variant="ghost" onClick={() => deleteStage.mutate(s.id)} title="Remover">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-border/40">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-9 rounded cursor-pointer bg-transparent border border-border/40" />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo estágio" className="flex-1" />
          <Button
            onClick={async () => {
              if (!newName.trim()) return;
              await createStage.mutateAsync({ name: newName.trim(), color: newColor, position: stages.length });
              setNewName(""); setNewColor("#D4A520");
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}