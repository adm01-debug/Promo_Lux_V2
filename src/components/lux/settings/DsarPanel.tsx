import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, ShieldAlert, Trash2, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDsar, type DsarRequestType } from "@/hooks/useDsar";

const TYPE_LABEL: Record<DsarRequestType, string> = {
  access: "Acesso",
  portability: "Portabilidade",
  erasure: "Esquecimento",
  rectification: "Retificação",
};

const TYPE_HINT: Record<DsarRequestType, string> = {
  access: "Exporta todos os dados do titular nesta organização.",
  portability: "Exporta os dados em JSON para entrega ao titular.",
  erasure: "Pseudonimiza nome, e-mail, telefone e payloads — sem apagar histórico.",
  rectification: "Exporta o estado atual para conferência antes da correção.",
};

export function DsarPanel() {
  const { requests, isLoading, slaAlerts, createRequest, fulfill, previewSubject, busyId } = useDsar();
  const [requestType, setRequestType] = useState<DsarRequestType>("access");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const overdue = slaAlerts.filter((a) => a.is_overdue).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    createRequest.mutate(
      { requestType, subjectEmail: email, subjectName: name || undefined },
      { onSuccess: () => { setEmail(""); setName(""); } },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Pedidos de titular (LGPD / GDPR)
        </h3>
        <p className="text-sm text-muted-foreground">
          Registre e atenda pedidos de acesso, portabilidade, retificação e esquecimento com prazo legal de 30 dias.
        </p>
      </div>

      {overdue > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">
            {overdue} pedido(s) fora do prazo legal. Atenda imediatamente para evitar exposição regulatória.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="rounded-lg border border-border/40 p-4 space-y-3">
        <p className="text-xs font-medium text-foreground">Registrar novo pedido</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="dsar-type" className="text-xs">Tipo</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as DsarRequestType)}>
              <SelectTrigger id="dsar-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as DsarRequestType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dsar-email" className="text-xs">E-mail do titular</Label>
            <Input
              id="dsar-email"
              type="email"
              placeholder="titular@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dsar-name" className="text-xs">Nome (opcional)</Label>
            <Input id="dsar-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{TYPE_HINT[requestType]}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!email.includes("@")}
              onClick={() => previewSubject(email)}
            >
              <UserSearch className="h-3.5 w-3.5 mr-1.5" /> Pré-visualizar
            </Button>
            <Button type="submit" size="sm" disabled={!email.includes("@") || createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Registrar pedido
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
          <p className="text-xs font-medium text-foreground">Pedidos registrados</p>
          <p className="text-xs text-muted-foreground">{requests.length} pedido(s)</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedidos…
          </div>
        ) : requests.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhum pedido registrado. O prazo legal de 30 dias é contado a partir do registro.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[r.request_type]}</Badge>
                    <span className="text-sm text-foreground truncate">{r.subject_email}</span>
                    {r.status === "completed" && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> atendido
                      </Badge>
                    )}
                    {r.is_overdue && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> vencido
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.status === "completed"
                      ? `Concluído em ${new Date(r.completed_at ?? r.due_at).toLocaleDateString("pt-BR")}`
                      : r.is_overdue
                        ? `Vencido há ${Math.abs(r.days_remaining)} dia(s)`
                        : `${r.days_remaining} dia(s) restantes`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => previewSubject(r.subject_email)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {r.status !== "completed" && (
                    <Button size="sm" disabled={busyId === r.id} onClick={() => fulfill(r.id)}>
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : r.request_type === "erasure" ? (
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {r.request_type === "erasure" ? "Apagar" : "Atender"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}