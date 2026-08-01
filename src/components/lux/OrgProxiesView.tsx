import { useState } from "react";
import { Plus, Trash2, Edit2, Globe, Shield, Activity, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/lux/EmptyState";
import {
  useOrgProxies, useUpdateProxy, useDeleteProxy, type OrgProxy,
} from "@/hooks/useOrgProxies";
import { ProxyFormDialog } from "./ProxyFormDialog";

const maskUrl = (url: string) => {
  try {
    const u = new URL(url);
    if (u.username) u.username = "•••";
    if (u.password) u.password = "•••";
    return u.toString();
  } catch {
    return url.replace(/\/\/([^@:/]+):([^@]+)@/, "//•••:•••@");
  }
};

const hasAuth = (url: string) => {
  try {
    return !!new URL(url).username;
  } catch {
    return /\/\/[^@:/]+:[^@]+@/.test(url);
  }
};

export const OrgProxiesView = () => {
  const { data: proxies = [], isLoading } = useOrgProxies();
  const update = useUpdateProxy();
  const remove = useDeleteProxy();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgProxy | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OrgProxy | null>(null);

  const toggleActive = async (proxy: OrgProxy) => {
    try {
      await update.mutateAsync({ id: proxy.id, is_active: !proxy.is_active });
      toast.success(proxy.is_active ? "Proxy desativado" : "Proxy ativado");
    } catch (err) {
      toast.error(`Falha: ${err instanceof Error ? err.message : "erro"}`);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success("Proxy excluído");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(`Falha ao excluir: ${err instanceof Error ? err.message : "erro"}`);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: OrgProxy) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Proxies da organização</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Proxies ativos são injetados automaticamente em novos jobs de raspagem. Apenas admins podem gerenciar.
            </p>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo proxy
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando proxies...
          </div>
        ) : proxies.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="Nenhum proxy cadastrado"
            description="Cadastre proxies para distribuir requisições de raspagem e evitar bloqueios do Google Maps."
            actions={[{ label: "Cadastrar primeiro proxy", onClick: openNew }]}
          />

        ) : (
          <div className="rounded-md border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Rótulo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Auth</TableHead>
                  <TableHead className="text-center">Uso</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.proxy_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[260px] truncate" title={maskUrl(p.url)}>
                      {maskUrl(p.url)}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasAuth(p.url) ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          <Shield className="h-2.5 w-2.5 mr-1" /> sim
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Activity className="h-3 w-3" /> {p.usage_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={() => toggleActive(p)}
                        disabled={update.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(p)}
                          aria-label="Editar proxy"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(p)}
                          aria-label="Excluir proxy"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ProxyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} proxy={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proxy?</AlertDialogTitle>
            <AlertDialogDescription>
              O proxy <span className="font-semibold">{confirmDelete?.label}</span> será removido
              permanentemente. Jobs em execução não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
