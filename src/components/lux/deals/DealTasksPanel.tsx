import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Bell, Calendar as CalIcon } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDealTasks } from "@/hooks/useDeals";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

interface Props { dealId?: string | null; }

export function DealTasksPanel({ dealId }: Props) {
  const { data: tasks = [], createTask, toggleTask, deleteTask } = useDealTasks(dealId);
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");

  const submit = async () => {
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title: title.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      remind_at: remindAt ? new Date(remindAt).toISOString() : null,
      deal_id: dealId ?? null,
    });
    setTitle(""); setDueAt(""); setRemindAt("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 p-3 rounded-lg border border-border/40 glass">
        <Input placeholder="Nova tarefa..." value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalIcon className="h-3 w-3" /> Vencimento
            </label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bell className="h-3 w-3" /> Lembrete
            </label>
            <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={submit} disabled={!title.trim() || createTask.isPending} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar tarefa
        </Button>
      </div>

      <div className="space-y-1.5">
        {tasks.map((t) => {
          const overdue = !t.completed && t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at));
          return (
            <div key={t.id}
              className={cn(
                "flex items-start gap-2 p-2.5 rounded-lg border transition-colors",
                t.completed ? "opacity-50 border-border/20" : "border-border/40",
                overdue && "border-destructive/40 bg-destructive/5"
              )}>
              <Checkbox checked={t.completed} onCheckedChange={(c) => toggleTask.mutate({ id: t.id, completed: !!c })} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                  {t.due_at && (
                    <span className={cn("flex items-center gap-1", overdue && "text-destructive")}>
                      <CalIcon className="h-2.5 w-2.5" />
                      {format(new Date(t.due_at), "dd MMM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {t.remind_at && (
                    <span className="flex items-center gap-1">
                      <Bell className="h-2.5 w-2.5" />
                      {format(new Date(t.remind_at), "dd MMM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteTask.mutate(t.id)} className="h-6 w-6">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
        )}
      </div>
    </div>
  );
}