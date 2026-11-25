import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Deal, DealStage } from "@/hooks/useDeals";
import { DealCard } from "./DealCard";
import { groupByCurrency, formatMoney } from "@/lib/money";

interface Props {
  stage: DealStage;
  deals: Deal[];
  onAddDeal: (stageId: string) => void;
  onSelectDeal: (deal: Deal) => void;
  /** Previsões por deal_id, resolvidas em O(1) pelo board. */
  predictions?: Map<string, { win_probability: number; weighted_value: number }>;
}

export function DealColumn({ stage, deals, onAddDeal, onSelectDeal, predictions }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "column", stage } });
  const totals = groupByCurrency(deals, (d) => d.value, (d) => d.currency);

  return (
    <div className="flex flex-col w-72 shrink-0 h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-lg glass border border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: stage.color }} />
          <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
          <span className="text-[10px] text-muted-foreground shrink-0">{deals.length}</span>
        </div>
        <span className="flex flex-col items-end gap-0.5 shrink-0">
          {totals.map((t) => (
            <span key={t.currency} className="text-[10px] text-primary font-mono leading-tight">
              {formatMoney(t.total, t.currency)}
            </span>
          ))}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto rounded-lg p-2 space-y-2 min-h-[200px] border border-transparent transition-colors",
          isOver && "bg-primary/5 border-primary/30"
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} onClick={() => onSelectDeal(d)} prediction={predictions?.get(d.id)} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6">Sem negócios</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAddDeal(stage.id)}
        className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar negócio
      </Button>
    </div>
  );
}