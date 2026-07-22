import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Pencil,
  Server,
  FlaskConical,
  Laptop,
  Globe,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { useEnvProfiles, type EnvProfile } from "@/hooks/useEnvProfiles";

interface EnvProfilesPanelProps {
  /** Recebe o redirect_uri do perfil ativo quando o usuário aplica. */
  onApply: (uri: string, profile: EnvProfile) => void;
  /** URI atualmente preenchido no sandbox — usado para destacar perfil atual. */
  currentUri: string;
}

const KIND_META: Record<EnvProfile["kind"], { label: string; tone: string; Icon: typeof Server }> = {
  production: { label: "Production", tone: "border-success/40 text-success", Icon: Globe },
  staging: { label: "Staging", tone: "border-warning/40 text-warning", Icon: FlaskConical },
  local: { label: "Local", tone: "border-primary/40 text-primary", Icon: Laptop },
  custom: { label: "Custom", tone: "border-border text-muted-foreground", Icon: Server },
};

/**
 * Painel de perfis de ambiente: troca rápida do redirect URI padrão,
 * marca qual perfil está ativo e permite criar/editar/remover perfis.
 */
export function EnvProfilesPanel({ onApply, currentUri }: EnvProfilesPanelProps) {
  const { profiles, activeId, setActiveId, upsert, remove, resetDefaults } = useEnvProfiles();
  const [editing, setEditing] = useState<EnvProfile | null>(null);
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const apply = (p: EnvProfile) => {
    setActiveId(p.id);
    onApply(p.redirect_uri, p);
    toast({ title: `Perfil "${p.name}" aplicado`, description: p.redirect_uri });
  };

  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Perfis de ambiente</h3>
          <Badge variant="outline" className="text-[10px]">{profiles.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-[11px]"
            onClick={async () => {
              const ok = await confirm({
                title: "Restaurar perfis padrão?",
                description: "Serão recriados Production, Staging e Local. Perfis personalizados NÃO serão afetados.",
                confirmLabel: "Restaurar",
              });
              if (ok) {
                resetDefaults();
                toast({ title: "Perfis padrão restaurados" });
              }
            }}
          >
            <RefreshCw className="h-3 w-3" /> Padrão
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[11px]"
                onClick={() => setEditing(null)}
              >
                <Plus className="h-3 w-3" /> Novo perfil
              </Button>
            </DialogTrigger>
            <ProfileFormDialog
              initial={editing}
              onSubmit={(data) => {
                upsert(data);
                toast({ title: editing ? "Perfil atualizado" : "Perfil criado" });
                setOpen(false);
                setEditing(null);
              }}
            />
          </Dialog>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Troque rapidamente entre redirect URIs de cada deployment. O perfil ativo será aplicado ao
        sandbox para validação.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {profiles.map((p) => {
          const meta = KIND_META[p.kind];
          const isActive = activeId === p.id;
          const matchesUri = currentUri.trim() === p.redirect_uri.trim();
          return (
            <div
              key={p.id}
              className={`rounded-md border p-2.5 space-y-1.5 transition-colors ${
                isActive
                  ? "border-primary/50 bg-primary/5"
                  : matchesUri
                    ? "border-success/30 bg-success/5"
                    : "border-border/40 bg-background/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <meta.Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{p.name}</span>
                    <Badge variant="outline" className={`text-[9px] h-4 px-1 ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                    {isActive && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/40 text-primary gap-1">
                        <Check className="h-2.5 w-2.5" /> ativo
                      </Badge>
                    )}
                  </div>
                  <code className="block text-[10px] font-mono text-muted-foreground truncate mt-0.5" title={p.redirect_uri}>
                    {p.redirect_uri}
                  </code>
                  {p.notes && <p className="text-[10px] text-muted-foreground/80 truncate">{p.notes}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "default"}
                  className="h-6 px-2 text-[10px] flex-1"
                  onClick={() => apply(p)}
                  disabled={isActive && matchesUri}
                >
                  {isActive && matchesUri ? "Em uso" : "Aplicar & validar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  aria-label="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Remover perfil "${p.name}"?`,
                      description: "Esta ação não pode ser desfeita.",
                      confirmLabel: "Remover",
                      variant: "destructive",
                    });
                    if (ok) {
                      remove(p.id);
                      toast({ title: "Perfil removido" });
                    }
                  }}
                  aria-label={`Remover perfil ${p.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileFormDialog({
  initial,
  onSubmit,
}: {
  initial: EnvProfile | null;
  onSubmit: (data: Omit<EnvProfile, "created_at">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [uri, setUri] = useState(initial?.redirect_uri ?? "");
  const [kind, setKind] = useState<EnvProfile["kind"]>(initial?.kind ?? "custom");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const valid = name.trim() && uri.trim();

  return (
    <DialogContent className="bg-card border-border/50">
      <DialogHeader>
        <DialogTitle className="text-base">
          {initial ? "Editar perfil" : "Novo perfil de ambiente"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Production EU"
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as EnvProfile["kind"])}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Redirect URI</Label>
          <Input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="https://app.example.com/integrations"
            className="h-9 text-xs font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas (opcional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: cluster EU, branch preview"
            className="h-9 text-xs"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          size="sm"
          disabled={!valid}
          onClick={() =>
            onSubmit({
              id: initial?.id ?? "",
              name: name.trim(),
              redirect_uri: uri.trim(),
              kind,
              notes: notes.trim() || undefined,
            })
          }
        >
          {initial ? "Salvar alterações" : "Criar perfil"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}