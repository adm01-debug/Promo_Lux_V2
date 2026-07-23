import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Phone, Mail as MailIcon, Calendar as CalIcon, FileText, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDeals, useDealActivities, useDealStages, type Deal, type DealActivity } from "@/hooks/useDeals";
import { useConfirm } from "@/hooks/confirm-context";
import { DealTasksPanel } from "./DealTasksPanel";

interface Props {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const TYPE_ICONS: Record<DealActivity["type"], React.ElementType> = {
  note: FileText, call: Phone, email: MailIcon, meeting: CalIcon, stage_change: Activity, system: Activity,
};

export function DealDetailDrawer({ deal, open, onOpenChange }: Props) {
  const { updateDeal, deleteDeal } = useDeals();
  const { data: stages = [] } = useDealStages();
  const { data: activities = [], addActivity } = useDealActivities(deal?.id ?? null);
  const confirm = useConfirm();
  const [actType, setActType] = useState<DealActivity["type"]>("note");
  const [actText, setActText] = useState("");

  if (!deal) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-start justify-between gap-3">
            <Input
              defaultValue={deal.title}
              onBlur={(e) => e.target.value !== deal.title && updateDeal.mutate({ id: deal.id, title: e.target.value, version: deal.version })}
              className="text-lg font-semibold border-0 px-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              size="icon" variant="ghost"
              aria-label="Excluir negócio"
              onClick={async () => {
                const ok = await confirm({
                  title: "Excluir este negócio?",
                  description: "Esta ação não pode ser desfeita. O histórico de atividades e tarefas relacionadas será perdido.",
                  confirmLabel: "Excluir",
                  variant: "destructive",
                });
                if (ok) { deleteDeal.mutate(deal.id); onOpenChange(false); }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</label>
            <Input
              type="number" defaultValue={deal.value ?? 0}
              onBlur={(e) => updateDeal.mutate({ id: deal.id, value: Number(e.target.value), version: deal.version })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Estágio</label>
            <Select value={deal.stage_id} onValueChange={(v) => updateDeal.mutate({ id: deal.id, stage_id: v, version: deal.version })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Prioridade</label>
            <Select value={deal.priority} onValueChange={(v) => updateDeal.mutate({ id: deal.id, priority: v as Deal["priority"], version: deal.version })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fech. esperado</label>
            <Input
              type="date" defaultValue={deal.expected_close_date ?? ""}
              onBlur={(e) => updateDeal.mutate({ id: deal.id, expected_close_date: e.target.value || null, version: deal.version })}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</label>
          <Textarea
            defaultValue={deal.description ?? ""} rows={3}
            onBlur={(e) => updateDeal.mutate({ id: deal.id, description: e.target.value || null, version: deal.version })}
          />
        </div>

        <Tabs defaultValue="timeline" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1">Tarefas</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-3 pt-3">
            <div className="flex items-start gap-2 p-3 rounded-lg border border-border/40">
              <Select value={actType} onValueChange={(v) => setActType(v as DealActivity["type"])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="call">Chamada</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={actText} onChange={(e) => setActText(e.target.value)}
                placeholder="Descreva a atividade..." rows={2} className="flex-1"
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (!actText.trim()) return;
                  await addActivity.mutateAsync({ type: actType, title: actText.trim().slice(0, 80), content: actText.trim() });
                  setActText("");
                }}
              >Add</Button>
            </div>

            <div className="space-y-2">
              {activities.map((a) => {
                const Icon = TYPE_ICONS[a.type] ?? FileText;
                return (
                  <div key={a.id} className="flex gap-3 p-3 rounded-lg border border-border/30 glass">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{a.title}</p>
                      {a.content && a.content !== a.title && (
                        <p className="text-xs text-muted-foreground mt-0.5">{a.content}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(a.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma atividade ainda</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="pt-3">
            <DealTasksPanel dealId={deal.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}