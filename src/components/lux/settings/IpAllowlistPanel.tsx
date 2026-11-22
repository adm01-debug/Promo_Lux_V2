import { useState } from "react";
import { ShieldCheck, ShieldAlert, Plus, Trash2, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useIpAllowlist } from "@/hooks/useIpAllowlist";

export function IpAllowlistPanel() {
  const { rules, status, enabled, isLoading, addRule, removeRule, setEnabled, isSaving } = useIpAllowlist();
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");

  const handleAdd = async () => {
    if (!cidr.trim()) return;
    await addRule({ cidr, label });
    setCidr("");
    setLabel("");
  };

  const handleToggle = async (next: boolean) => {
    await setEnabled(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando regras de IP...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" /> Restrição por IP
          </h3>
          <p className="text-sm text-muted-foreground">
            Limite o acesso à organização a faixas de IP conhecidas (CIDR). Desligado por padrão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? "Ativo" : "Desligado"}</span>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isSaving} />
        </div>
      </div>

      <div
        className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${
          status.allowed
            ? "border-success/30 bg-success/5 text-foreground"
            : "border-destructive/40 bg-destructive/5 text-foreground"
        }`}
      >
        {status.allowed ? (
          <ShieldCheck className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-medium">
            {status.allowed ? "Seu IP atual está liberado" : "Seu IP atual NÃO está liberado"}
          </p>
          <p className="text-muted-foreground">
            IP detectado: <span className="font-mono">{status.ip ?? "desconhecido"}</span> · {status.rules} regra(s)
          </p>
          {!status.allowed && (
            <p className="text-destructive mt-1">
              Desligue o bloqueio ou adicione uma faixa que contenha seu IP antes de sair desta página.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cidr" className="text-xs">Faixa CIDR</Label>
            <Input
              id="cidr"
              placeholder="203.0.113.0/24 ou 198.51.100.7"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-xs">Rótulo (opcional)</Label>
            <Input
              id="label"
              placeholder="Escritório SP"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={!cidr.trim() || isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              Nenhuma regra cadastrada. Sem regras, o bloqueio não tem efeito.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="font-mono text-[11px]">{rule.cidr}</Badge>
                  {rule.label && <span className="text-xs text-muted-foreground truncate">{rule.label}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(rule.id)}
                  disabled={isSaving}
                  aria-label={`Remover regra ${rule.cidr}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}