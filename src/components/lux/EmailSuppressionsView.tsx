import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldOff, Plus, Trash2, Search, Loader2, MailX } from "lucide-react";
import {
  useEmailSuppressions,
  SUPPRESSION_REASON_LABELS,
  type SuppressionReason,
} from "@/hooks/useEmailSuppressions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/lux/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const REASON_STYLES: Record<SuppressionReason, string> = {
  unsubscribe: "bg-muted text-muted-foreground",
  bounce: "bg-amber-500/15 text-amber-500",
  complaint: "bg-destructive/15 text-destructive",
  manual: "bg-primary/15 text-primary",
};

export function EmailSuppressionsView() {
  const { data, isLoading, addSuppression, removeSuppression } = useEmailSuppressions();
  const [newEmail, setNewEmail] = useState("");
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data ?? [];
    return q ? rows.filter((r) => r.email.includes(q)) : rows;
  }, [data, search]);

  const handleAdd = () => {
    if (!newEmail.trim()) return;
    addSuppression.mutate(
      { email: newEmail },
      { onSuccess: () => setNewEmail("") },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldOff className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lista de Supressão</h1>
          <p className="text-sm text-muted-foreground">
            E-mails que nunca receberão campanhas (descadastros, bounces e bloqueios manuais).
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 gap-2">
            <Input
              type="email"
              placeholder="adicionar e-mail para suprimir…"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={addSuppression.isPending}>
              {addSuppression.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">Suprimir</span>
            </Button>
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MailX}
            title={search ? "Nenhum resultado" : "Lista vazia"}
            description={
              search
                ? "Nenhum e-mail suprimido corresponde à busca."
                : "Ainda não há e-mails na lista de supressão."
            }
          />
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
            {filtered.map((row, i) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("border-0", REASON_STYLES[row.reason])}>
                    {SUPPRESSION_REASON_LABELS[row.reason]}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveTarget({ id: row.id, email: row.email })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            {filtered.length} de {data?.length ?? 0} e-mail(s)
          </p>
        )}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da supressão?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{removeTarget?.email}</span> voltará a
              poder receber campanhas. Esta ação é reversível — você pode suprimir novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeSuppression.mutate(removeTarget.id);
                setRemoveTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
