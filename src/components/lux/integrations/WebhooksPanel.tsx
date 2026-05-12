import { useState } from "react";
import { Plus, Trash2, Eye, RefreshCw, Power, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWebhooks, useWebhookDeliveries, WEBHOOK_EVENTS, type Webhook } from "@/hooks/useWebhooks";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  success: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
  pending: "bg-muted text-muted-foreground",
  retrying: "bg-primary/20 text-primary",
};

export function WebhooksPanel() {
  const { data: hooks = [], createWebhook, updateWebhook, deleteWebhook } = useWebhooks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [selected, setSelected] = useState<Webhook | null>(null);

  const submit = async () => {
    if (!name.trim() || !url.trim() || events.length === 0) return;
    await createWebhook.mutateAsync({ name: name.trim(), url: url.trim(), events });
    setOpen(false); setName(""); setUrl(""); setEvents([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Receba notificações HTTP em tempo real quando dados mudam. Cada entrega é assinada com HMAC-SHA256.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo webhook
        </Button>
      </div>

      <div className="glass rounded-lg border border-border/40 divide-y divide-border/30">
        {hooks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum webhook configurado</p>
        )}
        {hooks.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{h.name}</p>
                {!h.active && <Badge variant="destructive" className="text-[9px]">Inativo</Badge>}
                <Badge variant="secondary" className="text-[9px]">{h.events.length} eventos</Badge>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{h.url}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                <span className="text-success">{h.total_sent} ok</span> ·{" "}
                <span className="text-destructive">{h.total_failed} falhas</span>
                {h.last_triggered_at && <> · Último {format(new Date(h.last_triggered_at), "dd MMM HH:mm", { locale: ptBR })}</>}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setSelected(h)} title="Entregas">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => updateWebhook.mutate({ id: h.id, active: !h.active })} title="Ativar/desativar">
                <Power className={cn("h-3.5 w-3.5", h.active && "text-success")} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteWebhook.mutate(h.id)} title="Excluir">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader><DialogTitle>Novo Webhook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Slack notifier" />
            </div>
            <div>
              <Label>URL de destino</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Eventos</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-y-auto p-2 rounded border border-border/40">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 cursor-pointer text-xs">
                    <Checkbox
                      checked={events.includes(ev)}
                      onCheckedChange={(c) => setEvents(c ? [...events, ev] : events.filter((x) => x !== ev))}
                    />
                    <span className="font-mono">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!name.trim() || !url.trim() || events.length === 0}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && <DeliveriesDrawer webhook={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DeliveriesDrawer({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { data: deliveries = [], replay } = useWebhookDeliveries(webhook.id);
  const [showPayload, setShowPayload] = useState<string | null>(null);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="glass w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{webhook.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground break-all">{webhook.url}</p>
          <p className="text-[10px] text-muted-foreground">
            Secret HMAC: <code className="text-primary">{webhook.secret}</code>
          </p>
        </div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mt-6 mb-2">Últimas entregas</h3>
        <div className="space-y-2">
          {deliveries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma entrega ainda</p>
          )}
          {deliveries.map((d) => (
            <div key={d.id} className="p-3 rounded-lg border border-border/40 glass">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={cn("text-[9px] uppercase", STATUS_COLORS[d.status])}>{d.status}</Badge>
                  <code className="text-xs">{d.event}</code>
                  {d.status_code && <span className="text-[10px] text-muted-foreground">HTTP {d.status_code}</span>}
                </div>
                <Button
                  size="sm"
                  variant={d.status === "failed" || d.status === "retrying" ? "default" : "ghost"}
                  onClick={() => replay.mutate(d.id)}
                  disabled={replay.isPending}
                  title={`Reencolar entrega ${d.id.slice(0, 8)}`}
                  className="h-7 gap-1.5 text-[10px]"
                >
                  <RefreshCw className={cn("h-3 w-3", replay.isPending && "animate-spin")} />
                  Replay
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(d.created_at), "dd MMM HH:mm:ss", { locale: ptBR })} · {d.attempts} tentativa{d.attempts !== 1 ? "s" : ""}
              </p>
              {d.error_message && (
                <p className="text-[10px] text-destructive mt-1 font-medium">{d.error_message}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 mt-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                onClick={() => setShowPayload(showPayload === d.id ? null : d.id)}
              >
                <Terminal className="h-3 w-3" />
                {showPayload === d.id ? "Ocultar payload" : "Ver payload"}
              </Button>
              {showPayload === d.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 p-2 rounded bg-secondary/50 border border-border/40 overflow-hidden"
                >
                  <pre className="text-[9px] font-mono whitespace-pre-wrap break-all leading-tight">
                    {JSON.stringify(d.payload, null, 2)}
                  </pre>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}