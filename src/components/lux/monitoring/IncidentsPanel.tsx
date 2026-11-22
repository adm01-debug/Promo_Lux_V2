import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataError } from "@/components/lux/DataError";
import {
  IMPACT_LABEL,
  INCIDENT_STATUS_LABEL,
  useIncidents,
  useResolveIncident,
  useSaveIncident,
  usePublicStatus,
  type PublicIncident,
} from "@/hooks/useStatusPage";

export function IncidentsPanel() {
  const { data: incidents, isLoading, error, refetch } = useIncidents();
  const { data: status } = usePublicStatus();
  const save = useSaveIncident();
  const resolve = useResolveIncident();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<PublicIncident["impact"]>("minor");
  const [bodyText, setBodyText] = useState("");
  const [components, setComponents] = useState<string[]>([]);

  const available = (status?.components ?? []).map((c) => c.component);

  const submit = async () => {
    if (!title.trim()) return;
    await save.mutateAsync({
      title,
      impact,
      status: "investigating",
      components,
      body: bodyText,
    });
    setOpen(false);
    setTitle("");
    setBodyText("");
    setComponents([]);
  };

  const toggleComponent = (c: string) =>
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  if (error) return <DataError message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Incidentes</h3>
          <p className="text-xs text-muted-foreground">
            Publicados na pagina de status publica assim que criados.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Abrir incidente
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (incidents ?? []).length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" /> Nenhum incidente registrado.
        </div>
      ) : (
        <ul className="space-y-2">
          {(incidents ?? []).map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{i.title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {IMPACT_LABEL[i.impact]}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] ${
                      i.status === "resolved" ? "text-success" : "text-warning"
                    }`}
                  >
                    {INCIDENT_STATUS_LABEL[i.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(i.started_at).toLocaleString("pt-BR")}
                  {i.components.length > 0 && ` · ${i.components.join(", ")}`}
                </p>
              </div>
              {i.status !== "resolved" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolve.mutate(i.id)}
                  disabled={resolve.isPending}
                  className="h-7 shrink-0 gap-1 text-[11px]"
                >
                  {resolve.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Resolver
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Abrir incidente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Titulo</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Impacto</Label>
              <Select value={impact} onValueChange={(v) => setImpact(v as PublicIncident["impact"])}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["none", "minor", "major", "critical"] as const).map((v) => (
                    <SelectItem key={v} value={v}>{IMPACT_LABEL[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Componentes afetados</Label>
              {available.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nenhum componente com execucao recente.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {available.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleComponent(c)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        components.includes(c)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descricao</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="min-h-[90px] text-sm"
                placeholder="O que esta acontecendo e o que ja foi feito"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={!title.trim() || save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}