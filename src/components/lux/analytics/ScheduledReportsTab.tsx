import { useState } from "react";
import { CalendarClock, Plus, Trash2, Loader2, Mail, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { DataError } from "@/components/lux/DataError";
import { useScheduledReports, type ReportMetric, type ReportFrequency } from "@/hooks/useScheduledReports";

const METRIC_LABEL: Record<ReportMetric, string> = {
  conversion: "Conversão & ROI",
  enrichment: "Enriquecimento",
  pipeline: "Pipeline de vendas",
  campaigns: "Campanhas",
};

const FREQ_LABEL: Record<ReportFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const RUN_BADGE: Record<string, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-success/15 text-success" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
  skipped: { label: "Ignorado", className: "bg-muted text-muted-foreground" },
  pending: { label: "Enviando", className: "bg-warning/15 text-warning" },
};

function describeSchedule(r: {
  frequency: ReportFrequency; day_of_week: number | null; day_of_month: number | null; hour_utc: number;
}): string {
  const time = `${String(r.hour_utc).padStart(2, "0")}:00 UTC`;
  if (r.frequency === "daily") return `Todo dia às ${time}`;
  if (r.frequency === "weekly") return `Toda ${WEEKDAYS[r.day_of_week ?? 1]} às ${time}`;
  return `Todo dia ${r.day_of_month ?? 1} do mês às ${time}`;
}

interface FormState {
  name: string;
  metric: ReportMetric;
  frequency: ReportFrequency;
  day_of_week: number;
  day_of_month: number;
  hour_utc: number;
  recipients: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  metric: "conversion",
  frequency: "weekly",
  day_of_week: 1,
  day_of_month: 1,
  hour_utc: 9,
  recipients: "",
};

export const ScheduledReportsTab = () => {
  const { data, isLoading, error, refetch, runs, create, update, toggleActive, remove } = useScheduledReports();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (r: {
    id: string; name: string; metric: ReportMetric; frequency: ReportFrequency;
    day_of_week: number | null; day_of_month: number | null; hour_utc: number; recipients: string[];
  }) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      metric: r.metric,
      frequency: r.frequency,
      day_of_week: r.day_of_week ?? 1,
      day_of_month: r.day_of_month ?? 1,
      hour_utc: r.hour_utc,
      recipients: (r.recipients ?? []).join(", "),
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const recipients = form.recipients
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@") && e.includes("."));

    if (!form.name.trim()) return;
    if (!recipients.length) return;

    const payload = {
      name: form.name.trim(),
      metric: form.metric,
      frequency: form.frequency,
      day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
      day_of_month: form.frequency === "monthly" ? form.day_of_month : null,
      hour_utc: form.hour_utc,
      recipients,
    };

    if (editingId) {
      update.mutate({ ...payload, id: editingId, active: true }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  };

  const recipientsValid = form.recipients.split(/[,;\s]+/).some((e) => {
    const t = e.trim();
    return t.includes("@") && t.includes(".");
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  if (error) return <DataError message={(error as Error).message} onRetry={() => refetch()} />;

  const reports = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Relatórios agendados
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enviamos automaticamente por e-mail, usando a conta conectada da sua organização.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo relatório
        </Button>
      </div>

      {!reports.length ? (
        <div className="glass rounded-lg p-8 text-center space-y-2">
          <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhum relatório agendado ainda. Crie um para receber os números no seu e-mail sem precisar abrir o sistema.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="glass rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">{r.name}</span>
                  <Badge variant="outline" className="text-xs">{METRIC_LABEL[r.metric]}</Badge>
                  {!r.active && <Badge variant="outline" className="text-xs text-muted-foreground">Pausado</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                  <Clock className="h-3 w-3" /> {describeSchedule(r)}
                  <span className="text-muted-foreground/50">·</span>
                  <Mail className="h-3 w-3" /> {r.recipients.length} destinatário(s)
                  {r.last_sent_at && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      último envio {new Date(r.last_sent_at).toLocaleDateString("pt-BR")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={r.active}
                  onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })}
                  aria-label={r.active ? "Pausar relatório" : "Ativar relatório"}
                />
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => remove.mutate(r.id)}
                  aria-label="Excluir relatório"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!(runs.data ?? []).length && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Últimos envios</h4>
          <div className="glass rounded-lg divide-y divide-border/50">
            {(runs.data ?? []).slice(0, 8).map((run) => {
              const badge = RUN_BADGE[run.status] ?? RUN_BADGE.pending;
              const report = reports.find((r) => r.id === run.report_id);
              return (
                <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                    <span className="text-muted-foreground truncate">
                      {report?.name ?? "Relatório removido"} · {run.recipients_count} destinatário(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {run.error_message && (
                      <span className="flex items-center gap-1 text-destructive max-w-[220px] truncate" title={run.error_message}>
                        <AlertTriangle className="h-3 w-3 shrink-0" /> {run.error_message}
                      </span>
                    )}
                    <span>{new Date(run.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar relatório" : "Novo relatório agendado"}</DialogTitle>
            <DialogDescription>
              Escolha o que medir, com que frequência e para quais e-mails enviar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-name">Nome</Label>
              <Input
                id="report-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Resumo semanal de conversão"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>O que medir</Label>
                <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v as ReportMetric })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METRIC_LABEL) as ReportMetric[]).map((m) => (
                      <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as ReportFrequency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ_LABEL) as ReportFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {form.frequency === "weekly" && (
                <div className="space-y-1.5">
                  <Label>Dia da semana</Label>
                  <Select
                    value={String(form.day_of_week)}
                    onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.frequency === "monthly" && (
                <div className="space-y-1.5">
                  <Label>Dia do mês</Label>
                  <Select
                    value={String(form.day_of_month)}
                    onValueChange={(v) => setForm({ ...form, day_of_month: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Hora (UTC)</Label>
                <Select value={String(form.hour_utc)} onValueChange={(v) => setForm({ ...form, hour_utc: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-recipients">Destinatários</Label>
              <Input
                id="report-recipients"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                placeholder="financeiro@empresa.com, diretoria@empresa.com"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula. Máximo de 20 destinatários.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name.trim() || !recipientsValid || create.isPending || update.isPending}
              className="gap-2"
            >
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};