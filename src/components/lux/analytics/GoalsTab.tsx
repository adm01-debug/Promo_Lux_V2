import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Plus, Trash2, Pencil, Users } from "lucide-react";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { useOrgMembers } from "@/hooks/useOrganizations";
import {
  METRIC_LABEL,
  METRICS,
  PERIODS,
  PERIOD_LABEL,
  startOfCurrentPeriod,
  useCreateGoal,
  useDeleteGoal,
  useSalesGoals,
  useUpdateGoal,
  type GoalMetric,
  type GoalPeriod,
} from "@/hooks/useSalesGoals";

const formatCurrency = (v: number, currency = "BRL") =>
  v.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 });

const fmtValue = (metric: GoalMetric, v: number) =>
  metric === "won_value" ? formatCurrency(v) : v.toLocaleString("pt-BR");

const GoalCard = ({
  goal,
  canManage,
  onEdit,
  onDelete,
}: {
  goal: ReturnType<typeof useSalesGoals>["data"] extends (infer T)[] | undefined ? T : never;
  canManage: boolean;
  onEdit: (id: string, target: number) => void;
  onDelete: (id: string) => void;
}) => {
  const pct = Math.min(Math.round(goal.pct), 100);
  const hit = goal.pct >= 100;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium truncate">
              {goal.owner_id ? goal.owner_name ?? "Membro" : "Organização"}
            </CardTitle>
            <CardDescription className="text-xs">
              {METRIC_LABEL[goal.metric]} · {PERIOD_LABEL[goal.period]} ·{" "}
              {new Date(goal.period_start).toLocaleDateString("pt-BR")}
            </CardDescription>
          </div>
          <Badge variant={hit ? "default" : "secondary"} className="shrink-0 text-xs">
            {goal.pct.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2" />
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-base">
            {fmtValue(goal.metric, Number(goal.achieved))}
          </span>
          <span className="text-muted-foreground">
            de {fmtValue(goal.metric, Number(goal.target))}
          </span>
        </div>
        {canManage && (
          <div className="flex gap-1.5 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                const raw = window.prompt("Nova meta", String(goal.target));
                if (raw === null) return;
                const n = Number(raw.replace(",", "."));
                if (!Number.isFinite(n) || n < 0) return;
                onEdit(goal.goal_id, n);
              }}
            >
              <Pencil className="h-3 w-3" /> Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-destructive"
              onClick={() => onDelete(goal.goal_id)}
            >
              <Trash2 className="h-3 w-3" /> Remover
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const GoalsTab = () => {
  const { activeOrgId } = useActiveOrganization();
  const { data: members } = useOrgMembers(activeOrgId);
  const [period, setPeriod] = useState<GoalPeriod>("month");
  const { data: goals, isLoading } = useSalesGoals(period);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    owner_id: string;
    period: GoalPeriod;
    metric: GoalMetric;
    target: string;
    period_start: string;
  }>({ owner_id: "org", period: "month", metric: "won_value", target: "", period_start: startOfCurrentPeriod("month") });

  const byOwner = useMemo(() => {
    const team = (goals ?? []).filter((g) => g.owner_id !== null);
    const org = (goals ?? []).filter((g) => g.owner_id === null);
    return { team, org };
  }, [goals]);

  const submit = () => {
    const target = Number(form.target.replace(",", "."));
    if (!Number.isFinite(target) || target <= 0) return;
    createGoal.mutate(
      {
        owner_id: form.owner_id === "org" ? null : form.owner_id,
        period: form.period,
        period_start: form.period_start,
        metric: form.metric,
        target,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas & Cotas
          </h3>
          <p className="text-xs text-muted-foreground">
            Acompanhe o progresso real de cada meta contra os dados do CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Nova meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova meta</DialogTitle>
                <DialogDescription>
                  Defina alvo por membro ou para a organização inteira.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável</Label>
                  <Select
                    value={form.owner_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org">Organização inteira</SelectItem>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.full_name ?? m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Métrica</Label>
                    <Select
                      value={form.metric}
                      onValueChange={(v) => setForm((f) => ({ ...f, metric: v as GoalMetric }))}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METRICS.map((m) => (
                          <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Período</Label>
                    <Select
                      value={form.period}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          period: v as GoalPeriod,
                          period_start: startOfCurrentPeriod(v as GoalPeriod),
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERIODS.map((p) => (
                          <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alvo</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.target}
                      onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                      placeholder={form.metric === "won_value" ? "100000" : "20"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={form.period_start}
                      onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={createGoal.isPending || !form.target}>
                  {createGoal.isPending ? "Criando..." : "Criar meta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : (goals ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Target className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma meta para {PERIOD_LABEL[period].toLowerCase()}</p>
            <p className="text-xs text-muted-foreground">
              Crie a primeira meta para acompanhar o desempenho da equipe.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {byOwner.org.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Organização
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {byOwner.org.map((g) => (
                  <GoalCard
                    key={g.goal_id}
                    goal={g}
                    canManage
                    onEdit={(id, target) => updateGoal.mutate({ id, target })}
                    onDelete={(id) => deleteGoal.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}
          {byOwner.team.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Equipe
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {byOwner.team.map((g) => (
                  <GoalCard
                    key={g.goal_id}
                    goal={g}
                    canManage
                    onEdit={(id, target) => updateGoal.mutate({ id, target })}
                    onDelete={(id) => deleteGoal.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};