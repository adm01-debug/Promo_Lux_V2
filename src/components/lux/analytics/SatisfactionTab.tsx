import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquareHeart, Plus, Trash2, Link2, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  useCreateSurvey,
  useCreateSurveyInvite,
  useDeleteSurvey,
  useSurveys,
  useToggleSurvey,
  type SurveyKind,
  type SurveyStats,
} from "@/hooks/useSatisfaction";

const IndexBadge = ({ survey }: { survey: SurveyStats }) => {
  if (survey.responses === 0) {
    return <Badge variant="outline" className="text-xs">Sem respostas</Badge>;
  }
  const v = Number(survey.score_index);
  const positive = survey.kind === "nps" ? v >= 50 : v >= 80;
  const negative = survey.kind === "nps" ? v < 0 : v < 50;
  return (
    <Badge variant={positive ? "default" : negative ? "destructive" : "secondary"} className="text-xs tabular-nums">
      {survey.kind === "nps" ? `NPS ${v > 0 ? "+" : ""}${v}` : `CSAT ${v}%`}
    </Badge>
  );
};

const Breakdown = ({ survey }: { survey: SurveyStats }) => {
  const total = Number(survey.responses);
  if (!total) return null;
  const pct = (n: number) => Math.round((Number(n) / total) * 100);
  const rows =
    survey.kind === "nps"
      ? [
          { label: "Promotores", n: Number(survey.promoters), Icon: ThumbsUp, cls: "text-emerald-500" },
          { label: "Neutros", n: Number(survey.passives), Icon: Minus, cls: "text-slate-400" },
          { label: "Detratores", n: Number(survey.detractors), Icon: ThumbsDown, cls: "text-destructive" },
        ]
      : [
          { label: "Positivos (4-5)", n: Number(survey.promoters) + Number(survey.passives), Icon: ThumbsUp, cls: "text-emerald-500" },
          { label: "Críticos (0-3)", n: Number(survey.detractors), Icon: ThumbsDown, cls: "text-destructive" },
        ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <r.Icon className={cn("h-3.5 w-3.5 shrink-0", r.cls)} />
          <span className="w-28 shrink-0 text-muted-foreground">{r.label}</span>
          <Progress value={pct(r.n)} className="h-1.5 flex-1" />
          <span className="w-8 text-right tabular-nums">{r.n}</span>
        </div>
      ))}
    </div>
  );
};

export const SatisfactionTab = () => {
  const { data: surveys, isLoading } = useSurveys();
  const createSurvey = useCreateSurvey();
  const toggleSurvey = useToggleSurvey();
  const deleteSurvey = useDeleteSurvey();
  const createInvite = useCreateSurveyInvite();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; kind: SurveyKind; question: string }>({
    name: "",
    kind: "nps",
    question: "De 0 a 10, qual a chance de você recomendar nossa empresa a um colega?",
  });

  const submit = () => {
    if (!form.name.trim() || !form.question.trim()) return;
    createSurvey.mutate(form, { onSuccess: () => { setOpen(false); setForm((f) => ({ ...f, name: "" })); } });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <MessageSquareHeart className="h-4 w-4" /> NPS & CSAT
          </h3>
          <p className="text-xs text-muted-foreground">
            Meça a satisfação dos clientes e acompanhe a evolução das respostas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Nova pesquisa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova pesquisa de satisfação</DialogTitle>
              <DialogDescription>
                NPS usa escala 0-10; CSAT usa 1-5 normalizado em percentual.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Pós-onboarding Q4"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as SurveyKind }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nps">NPS — recomendação (0-10)</SelectItem>
                    <SelectItem value="csat">CSAT — satisfação (1-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pergunta</Label>
                <Input
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={createSurvey.isPending || !form.name.trim()}>
                {createSurvey.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      ) : (surveys ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <MessageSquareHeart className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma pesquisa criada</p>
            <p className="text-xs text-muted-foreground">
              Crie uma pesquisa para medir a satisfação dos seus clientes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(surveys ?? []).map((s) => (
            <Card key={s.survey_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-medium truncate">{s.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {KIND_LABEL[s.kind]} · escala {s.kind === "csat" ? "1" : "0"}-{s.scale_max} · {Number(s.responses)} respostas
                    </CardDescription>
                  </div>
                  <IndexBadge survey={s} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Breakdown survey={s} />
                {Number(s.pending) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {Number(s.pending)} convite(s) aguardando resposta
                  </p>
                )}
                {Number(s.responses) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Média {Number(s.avg_score).toFixed(1)} / {s.scale_max}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      const email = window.prompt("E-mail do cliente (opcional)", "");
                      if (email === null) return;
                      createInvite.mutate({
                        survey_id: s.survey_id,
                        organization_id: s.organization_id,
                        contact_email: email || undefined,
                      });
                    }}
                    disabled={createInvite.isPending}
                  >
                    <Link2 className="h-3 w-3" /> Gerar link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => toggleSurvey.mutate({ id: s.survey_id, active: false })}
                  >
                    Pausar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-destructive"
                    onClick={() => deleteSurvey.mutate(s.survey_id)}
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};