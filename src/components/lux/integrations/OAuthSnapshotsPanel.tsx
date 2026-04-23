import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  useOAuthSandboxSnapshots,
  useSaveOAuthSnapshot,
  useDeleteOAuthSnapshot,
  diffSnapshots,
  type OAuthSnapshot,
  type SaveSnapshotInput,
} from "@/hooks/useOAuthSandboxSnapshots";
import { usePermissions } from "@/hooks/usePermissions";
import { Trash2, Save, GitCompare, Clock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

interface OAuthSnapshotsPanelProps {
  /** Resultado atual do dry-run — habilita o botão "Salvar snapshot". */
  pending: SaveSnapshotInput | null;
}

/**
 * Lista snapshots de validação OAuth da organização e permite comparar dois
 * resultados lado a lado para destacar diferenças (provider, redirect URI, scopes).
 */
export function OAuthSnapshotsPanel({ pending }: OAuthSnapshotsPanelProps) {
  const { isAdmin } = usePermissions();
  const { data: snapshots = [], isLoading } = useOAuthSandboxSnapshots();
  const save = useSaveOAuthSnapshot();
  const remove = useDeleteOAuthSnapshot();

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [compareOpen, setCompareOpen] = useState(false);

  const left = useMemo(() => snapshots.find((s) => s.id === leftId) ?? null, [snapshots, leftId]);
  const right = useMemo(() => snapshots.find((s) => s.id === rightId) ?? null, [snapshots, rightId]);
  const diffs = useMemo(() => (left && right ? diffSnapshots(left, right) : []), [left, right]);
  const changedCount = diffs.filter((d) => d.changed).length;

  const handleSave = () => {
    if (!pending) return;
    if (!label.trim()) {
      toast({ title: "Informe um nome", description: "Ex.: 'Produção · pré-deploy', 'Staging gmail'", variant: "destructive" });
      return;
    }
    save.mutate(
      { ...pending, label: label.trim(), notes: notes.trim() || null },
      {
        onSuccess: (snap) => {
          setLabel("");
          setNotes("");
          toast({ title: "Snapshot salvo", description: `"${snap.label}" registrado para a organização.` });
        },
        onError: (e: Error) => toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="glass rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Histórico de validações
            <Badge variant="outline" className="text-[10px]">{snapshots.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Salve resultados do sandbox para comparar entre ambientes (ex.: staging vs produção).
          </p>
        </div>
        {snapshots.length >= 2 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setLeftId(snapshots[1].id);
              setRightId(snapshots[0].id);
              setCompareOpen(true);
            }}
          >
            <GitCompare className="h-3.5 w-3.5" /> Comparar versões
          </Button>
        )}
      </div>

      {pending && isAdmin && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <Save className="h-3 w-3 text-primary" />
            Salvar resultado atual ({pending.provider} · {pending.scope_type})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Nome</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex.: Produção · gmail · 2026-04"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Notas (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ambiente, ticket, motivo do teste…"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={save.isPending} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar snapshot
            </Button>
          </div>
        </div>
      )}

      {!pending && (
        <p className="text-[11px] text-muted-foreground italic">
          Rode uma validação acima para habilitar o salvamento.
        </p>
      )}

      <div className="space-y-1.5">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!isLoading && snapshots.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum snapshot salvo ainda.</p>
        )}
        {snapshots.map((s) => (
          <SnapshotRow
            key={s.id}
            snap={s}
            isAdmin={isAdmin}
            onDelete={() => remove.mutate(s.id)}
            onSelectLeft={() => {
              setLeftId(s.id);
              if (rightId && rightId !== s.id) setCompareOpen(true);
            }}
            onSelectRight={() => {
              setRightId(s.id);
              if (leftId && leftId !== s.id) setCompareOpen(true);
            }}
            isLeft={leftId === s.id}
            isRight={rightId === s.id}
          />
        ))}
      </div>

      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" /> Comparar snapshots
            </SheetTitle>
            <SheetDescription>
              {left && right ? (
                <span className="text-xs">
                  {changedCount === 0
                    ? "Configurações idênticas — nenhuma diferença detectada."
                    : `${changedCount} de ${diffs.length} campos mudaram entre estes snapshots.`}
                </span>
              ) : (
                <span className="text-xs">Selecione dois snapshots para comparar.</span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SnapshotPicker label="Versão A" value={leftId} onChange={setLeftId} options={snapshots} exclude={rightId} />
              <SnapshotPicker label="Versão B" value={rightId} onChange={setRightId} options={snapshots} exclude={leftId} />
            </div>

            {left && right && (
              <div className="rounded-md border border-border/40 divide-y divide-border/40">
                {diffs.map((d) => (
                  <DiffRow key={d.field} entry={d} />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SnapshotRow({
  snap,
  isAdmin,
  onDelete,
  onSelectLeft,
  onSelectRight,
  isLeft,
  isRight,
}: {
  snap: OAuthSnapshot;
  isAdmin: boolean;
  onDelete: () => void;
  onSelectLeft: () => void;
  onSelectRight: () => void;
  isLeft: boolean;
  isRight: boolean;
}) {
  const ok = snap.client_id_configured && snap.client_secret_configured && snap.warnings.length === 0;
  return (
    <div className="rounded-md border border-border/40 p-2.5 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium truncate">{snap.label}</span>
          <Badge variant="outline" className="text-[10px]">{snap.provider}</Badge>
          <Badge variant="outline" className="text-[10px]">{snap.scope_type}</Badge>
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 ${ok ? "text-success border-success/30" : "text-warning border-warning/40"}`}
          >
            {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
            {ok ? "OK" : `${snap.warnings.length} aviso${snap.warnings.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono" title={snap.redirect_uri_normalized}>
          {snap.redirect_uri_normalized}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {new Date(snap.created_at).toLocaleString("pt-BR")} · {snap.scopes.length} scopes
          {snap.notes && <span className="ml-1 italic">· {snap.notes}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant={isLeft ? "default" : "ghost"}
          className="h-7 text-[10px] px-2"
          onClick={onSelectLeft}
          title="Usar como versão A na comparação"
        >
          A
        </Button>
        <Button
          size="sm"
          variant={isRight ? "default" : "ghost"}
          className="h-7 text-[10px] px-2"
          onClick={onSelectRight}
          title="Usar como versão B na comparação"
        >
          B
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Excluir snapshot"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SnapshotPicker({
  label,
  value,
  onChange,
  options,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: OAuthSnapshot[];
  exclude: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
        <SelectContent>
          {options
            .filter((o) => o.id !== exclude)
            .map((o) => (
              <SelectItem key={o.id} value={o.id} className="text-xs">
                {o.label} · {o.provider}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DiffRow({ entry }: { entry: ReturnType<typeof diffSnapshots>[number] }) {
  const fmt = (v: string | string[] | boolean | null): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "✓ sim" : "✗ não";
    if (Array.isArray(v)) return v.length === 0 ? "(vazio)" : v.join(", ");
    return v;
  };
  return (
    <div className={`p-2.5 grid grid-cols-[140px_1fr_auto_1fr] gap-2 items-start text-xs ${entry.changed ? "bg-warning/5" : ""}`}>
      <div className="font-medium text-muted-foreground">
        {entry.label}
        {entry.changed && <Badge variant="outline" className="ml-1 text-[9px] border-warning/40 text-warning">mudou</Badge>}
      </div>
      <div className={`break-all ${entry.changed ? "text-foreground" : "text-muted-foreground"}`}>
        <code className="text-[11px] bg-muted/40 rounded px-1 py-0.5">{fmt(entry.left)}</code>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground mt-1" />
      <div className={`break-all ${entry.changed ? "text-foreground font-medium" : "text-muted-foreground"}`}>
        <code className="text-[11px] bg-muted/40 rounded px-1 py-0.5">{fmt(entry.right)}</code>
      </div>
    </div>
  );
}