import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Building2, Kanban, Mail, Workflow, Loader2 } from "lucide-react";
import { db, type SoftDeleteTable } from "@/integrations/supabase/withOrg";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TrashItem {
  id: string;
  name: string;
  deleted_at: string;
}

const TABS: { key: SoftDeleteTable; label: string; icon: typeof Building2 }[] = [
  { key: "companies", label: "Empresas", icon: Building2 },
  { key: "deals", label: "Negócios", icon: Kanban },
  { key: "campaigns", label: "Campanhas", icon: Mail },
  { key: "workflows", label: "Workflows", icon: Workflow },
];

const daysLeft = (deletedAt: string) => {
  const expires = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
};

function TrashList({ table }: { table: SoftDeleteTable }) {
  const queryClient = useQueryClient();
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);

  const { data, isLoading } = useQuery<TrashItem[]>({
    queryKey: ["trash", table],
    queryFn: async () => {
      const { data, error } = await db
        .trash(table)
        .select("id, name, deleted_at")
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrashItem[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["trash", table] });
    queryClient.invalidateQueries({ queryKey: [`${table}-list`] });
    queryClient.invalidateQueries({ queryKey: [table] });
  };

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.restore(table, id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Item restaurado" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" }),
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.hardDelete(table, id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Item excluído permanentemente" }); setPurgeTarget(null); invalidate(); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!data?.length) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhum item na lixeira.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.id} className="glass rounded-lg p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name || "Sem nome"}</p>
              <p className="text-[10px] text-muted-foreground">
                Excluído em {new Date(item.deleted_at).toLocaleString("pt-BR")} · expira em {daysLeft(item.deleted_at)} dia(s)
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => restore.mutate(item.id)} disabled={restore.isPending}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setPurgeTarget(item)}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              "{purgeTarget?.name}" será removido de forma definitiva e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => purgeTarget && purge.mutate(purgeTarget.id)}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const RecycleBinView = () => {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-primary" /> Lixeira
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Itens excluídos ficam aqui por 30 dias antes da remoção permanente. Restaure ou exclua definitivamente.
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-4">
            <TrashList table={key} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
