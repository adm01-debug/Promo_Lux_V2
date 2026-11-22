import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TrendingDown } from "lucide-react";
import {
  useLostReasons, useLostReasonStats, useLostReasonSeed,
  CATEGORY_LABEL, type LostReasonCategory,
} from "@/hooks/useLostReasons";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const CATEGORIES = Object.keys(CATEGORY_LABEL) as LostReasonCategory[];

/**
 * Análise de perdas: motivos cadastrados + volume/valor perdido por motivo.
 * Também permite manter o catálogo (adicionar, desativar, remover).
 */
export function LostReasonsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { reasons, isLoading, createReason, updateReason, deleteReason } = useLostReasons();
  const { data: stats = [], isLoading: statsLoading } = useLostReasonStats();
  useLostReasonSeed();

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<LostReasonCategory>("price");

  const statsByReason = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    for (const s of stats) m.set(s.lost_reason_id, { count: s.deal_count, value: Number(s.total_value) });
    return m;
  }, [stats]);

  const totalLost = stats.reduce((s, r) => s + Number(r.total_value), 0);
  const totalDeals = stats.reduce((s, r) => s + r.deal_count, 0);

  const handleAdd = () => {
    if (!label.trim()) return;
    createReason.mutate({ label, category }, { onSuccess: () => setLabel("") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" /> Análise de perdas
          </DialogTitle>
          <DialogDescription>
            {totalDeals > 0
              ? `${totalDeals} negócio(s) perdido(s) · ${fmtBRL(totalLost)} em valor`
              : "Nenhum negócio perdido com motivo registrado ainda."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Novo motivo</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Preço acima do orçamento"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="w-40">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Categoria</label>
              <Select value={category} onValueChange={(v) => setCategory(v as LostReasonCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!label.trim() || createReason.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando motivos…</p>
          ) : reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum motivo cadastrado. Adicione o primeiro acima.</p>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {reasons.map((r) => {
                const st = statsByReason.get(r.id);
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${r.active ? "" : "line-through text-muted-foreground"}`}>
                        {r.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[r.category]}</p>
                    </div>
                    {st && st.count > 0 && (
                      <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                        {st.count} · {fmtBRL(st.value)}
                      </Badge>
                    )}
                    <Button
                      variant="ghost" size="sm" className="text-[11px] shrink-0"
                      onClick={() => updateReason.mutate({ id: r.id, active: !r.active })}
                      title={r.active ? "Desativar nas opções" : "Reativar nas opções"}
                    >
                      {r.active ? "Ativo" : "Inativo"}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteReason.mutate(r.id)}
                      title="Remover motivo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {!statsLoading && stats.length > 0 && (
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {stats[0].label} lidera as perdas ({stats[0].deal_count} de {totalDeals}).
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}