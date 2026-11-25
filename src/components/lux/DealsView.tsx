import { useState, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { Plus, Settings as SettingsIcon, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDeals, useDealStages, type Deal } from "@/hooks/useDeals";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { DealColumn } from "./deals/DealColumn";
import { DealCard } from "./deals/DealCard";
import { useDealPredictions } from "@/hooks/useDealPredictions";
import { useLeadScores } from "@/hooks/useLeadScores";
import { AddDealDialog } from "./deals/AddDealDialog";
import { StagesManagerDialog } from "./deals/StagesManagerDialog";
import { LostReasonsDialog } from "./deals/LostReasonsDialog";
import { DealDetailDrawer } from "./deals/DealDetailDrawer";
import { PermissionGate } from "@/components/lux/permissions/PermissionGate";
import { groupByCurrency, formatCurrencyTotals } from "@/lib/money";

export function DealsView() {
  useTaskReminders();

  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const { data: deals = [], updateDeal } = useDeals();
  const { byDealId: predictions } = useDealPredictions();
  const { refresh: refreshScores } = useLeadScores();

  const [addOpen, setAddOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
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

  const totals = useMemo(() => groupByCurrency(deals, (d) => d.value, (d) => d.currency), [deals]);

  const weightedTotals = useMemo(
    () =>
      groupByCurrency(
        deals,
        (d) => predictions.get(d.id)?.weighted_value ?? 0,
        (d) => d.currency,
      ).filter((t) => t.total > 0),
    [deals, predictions],
  );

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
              {formatCurrencyTotals(totals)}
            </span>
            {weightedTotals.length > 0 && (
              <span className="text-muted-foreground" title="Receita esperada = valor × probabilidade de fechamento">
                · Ponderado <span className="text-success font-mono">
                  {formatCurrencyTotals(weightedTotals)}
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => refreshScores.mutate()}
            disabled={refreshScores.isPending}
            title="Recalcular probabilidade dos deals e scores dos stakeholders"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshScores.isPending && "animate-spin")} />
            Recalcular previsões
          </Button>
          <Button variant="outline" onClick={() => setStagesOpen(true)}>
            <SettingsIcon className="h-4 w-4 mr-1.5" /> Estágios
          </Button>
          <Button variant="outline" onClick={() => setLostOpen(true)}>
            <TrendingDown className="h-4 w-4 mr-1.5" /> Perdas
          </Button>
          <PermissionGate entity="deals" action="create">
            <Button onClick={() => { setDefaultStage(null); setAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo Negócio
            </Button>
          </PermissionGate>
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
                predictions={predictions}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingDeal && (
              <DealCard deal={draggingDeal} onClick={() => {}} prediction={predictions.get(draggingDeal.id)} />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} stages={stages} defaultStageId={defaultStage} />
      <StagesManagerDialog open={stagesOpen} onOpenChange={setStagesOpen} />
      <LostReasonsDialog open={lostOpen} onOpenChange={setLostOpen} deals={deals} />
      <DealDetailDrawer deal={activeDeal} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}