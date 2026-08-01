import { useState, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { Plus, Settings as SettingsIcon, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeals, useDealStages, type Deal } from "@/hooks/useDeals";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { DealColumn } from "./deals/DealColumn";
import { DealCard } from "./deals/DealCard";
import { AddDealDialog } from "./deals/AddDealDialog";
import { StagesManagerDialog } from "./deals/StagesManagerDialog";
import { DealDetailDrawer } from "./deals/DealDetailDrawer";

export function DealsView() {
  useTaskReminders();

  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const { data: deals = [], updateDeal } = useDeals();

  const [addOpen, setAddOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draggingDeal, setDraggingDeal] = useState<Deal | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const d of deals) {
      if (map[d.stage_id]) map[d.stage_id].push(d);
    }
    return map;
  }, [deals, stages]);

  const totalValue = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);

  const onDragStart = (e: DragStartEvent) => {
    const d = deals.find((x) => x.id === e.active.id);
    if (d) setDraggingDeal(d);
  };

  const onDragOver = (_e: DragOverEvent) => { /* no-op visual handled by Droppable */ };

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingDeal(null);
    const { active, over } = e;
    if (!over) return;
    const dragged = deals.find((d) => d.id === active.id);
    if (!dragged) return;

    // Determine target stage: dropped over column OR over another deal
    let targetStageId: string | null = null;
    if (stages.some((s) => s.id === over.id)) {
      targetStageId = String(over.id);
    } else {
      const overDeal = deals.find((d) => d.id === over.id);
      if (overDeal) targetStageId = overDeal.stage_id;
    }
    if (!targetStageId || targetStageId === dragged.stage_id) return;

    updateDeal.mutate({ id: dragged.id, stage_id: targetStageId, version: dragged.version });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de Vendas</h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-primary" />
            {deals.length} negócios · Total{" "}
            <span className="text-primary font-mono">
              {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStagesOpen(true)}>
            <SettingsIcon className="h-4 w-4 mr-1.5" /> Estágios
          </Button>
          <Button onClick={() => { setDefaultStage(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Negócio
          </Button>
        </div>
      </div>

      {/* Board */}
      {stagesLoading ? (
        <div className="text-sm text-muted-foreground">Carregando pipeline...</div>
      ) : stages.length === 0 ? (
        <div className="text-sm text-muted-foreground">Configurando estágios padrão...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
            {stages.map((s) => (
              <DealColumn
                key={s.id}
                stage={s}
                deals={dealsByStage[s.id] ?? []}
                onAddDeal={(sid) => { setDefaultStage(sid); setAddOpen(true); }}
                onSelectDeal={(d) => { setActiveDeal(d); setDetailOpen(true); }}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingDeal && <DealCard deal={draggingDeal} onClick={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}

      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} stages={stages} defaultStageId={defaultStage} />
      <StagesManagerDialog open={stagesOpen} onOpenChange={setStagesOpen} />
      <DealDetailDrawer deal={activeDeal} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}