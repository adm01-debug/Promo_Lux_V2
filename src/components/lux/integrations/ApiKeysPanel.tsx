import { useState } from "react";
import { Plus, Trash2, Copy, Check, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useApiKeys } from "@/hooks/useApiKeys";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ApiKeysPanel() {
  const { data: keys = [], createKey, revokeKey, deleteKey } = useApiKeys();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    const result = await createKey.mutateAsync({ name: name.trim(), scopes });
    setCreatedKey(result.full);
    setName(""); setScopes(["read"]);
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 1500);
  };

  const closeDialog = () => {
    setOpen(false);
    setCreatedKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Use chaves de API para autenticar requisições ao endpoint <code className="text-primary">/public-api</code>.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova chave
        </Button>
      </div>

      <div className="glass rounded-lg border border-border/40 divide-y divide-border/30">
        {keys.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma chave criada ainda</p>
        )}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{k.name}</p>
                {!k.active && <Badge variant="destructive" className="text-[9px]">Revogada</Badge>}
                {k.scopes.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>
                ))}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {k.prefix}••••••••••••••••••••
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Criada {format(new Date(k.created_at), "dd MMM yyyy", { locale: ptBR })}
                {k.last_used_at && <> · Último uso {format(new Date(k.last_used_at), "dd MMM HH:mm", { locale: ptBR })}</>}
              </p>
            </div>
            <div className="flex gap-1">
              {k.active && (
                <Button size="icon" variant="ghost" onClick={() => revokeKey.mutate(k.id)} title="Revogar">
                  <Power className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => deleteKey.mutate(k.id)} title="Excluir">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(o); }}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>{createdKey ? "Sua nova chave" : "Nova API Key"}</DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-3">
              <p className="text-xs text-destructive">
                ⚠️ Copie esta chave agora — ela não será exibida novamente.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40">
                <code className="flex-1 text-xs font-mono break-all">{createdKey}</code>
                <Button size="sm" variant="outline" onClick={copyKey}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button onClick={closeDialog} className="w-full">Concluir</Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: CRM externo" />
                </div>
                <div>
                  <Label>Escopos</Label>
                  <div className="flex gap-4 mt-2">
                    {["read", "write"].map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={scopes.includes(s)}
                          onCheckedChange={(c) => setScopes(c ? [...scopes, s] : scopes.filter((x) => x !== s))}
                        />
                        <span className="text-sm capitalize">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={!name.trim() || scopes.length === 0 || createKey.isPending}>
                  Gerar chave
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}