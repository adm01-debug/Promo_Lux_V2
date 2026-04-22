import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Users, Link2, Copy, Trash2, Shield, UserCog, Check, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMyOrganizations, useActiveOrganization, useOrgMembers, useOrgInvites,
  useCreateOrganization, useCreateInvite, useRevokeInvite,
  useUpdateMemberRole, useRemoveMember, type AppRole,
} from "@/hooks/useOrganizations";
import { EmptyState } from "@/components/lux/EmptyState";
import { DataError } from "@/components/lux/DataError";
import { PermissionsMatrix } from "@/components/lux/permissions/PermissionsMatrix";

const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", sdr: "SDR", viewer: "Viewer" };
const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

export const OrganizationsView = () => {
  const { user } = useAuth();
  const { data: orgs, isLoading, error, refetch } = useMyOrganizations();
  const { activeOrgId, activeOrg, setActive } = useActiveOrganization();
  const { data: members } = useOrgMembers(activeOrgId);
  const { data: invites } = useOrgInvites(activeOrgId);

  const createOrg = useCreateOrganization();
  const createInvite = useCreateInvite(activeOrgId);
  const revokeInvite = useRevokeInvite(activeOrgId);
  const updateRole = useUpdateMemberRole(activeOrgId);
  const removeMember = useRemoveMember(activeOrgId);

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<AppRole>("viewer");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string; isMe: boolean } | null>(null);

  const myMembership = (members ?? []).find(m => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "admin";
  const myRole = (myMembership?.role as AppRole | undefined) ?? null;

  const handleCreate = async () => {
    const name = newOrgName.trim();
    if (name.length < 2) {
      toast({ title: "Nome muito curto", variant: "destructive" });
      return;
    }
    try {
      const created = await createOrg.mutateAsync({ name });
      setActive(created.id);
      setNewOrgName("");
      setNewOrgOpen(false);
      toast({ title: "Workspace criado", description: created.name });
    } catch (e) {
      toast({ title: "Erro ao criar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleCreateInvite = async () => {
    try {
      const created = await createInvite.mutateAsync({ role: inviteRole });
      const url = `${window.location.origin}/invite/${created.token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Convite gerado e link copiado para a área de transferência." });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado" });
  };

  if (error) {
    return <DataError message={(error as Error).message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Workspaces
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie organizações, membros e convites por papel
          </p>
        </div>
        <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo workspace</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar novo workspace</DialogTitle>
              <DialogDescription>
                Você será automaticamente o administrador e poderá convidar membros depois.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome do workspace</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Ex: Acme Sales Team"
                maxLength={60}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOrgOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createOrg.isPending}>
                {createOrg.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="glass rounded-lg p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !orgs || orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum workspace ainda"
          description="Crie seu primeiro workspace para colaborar com a equipe."
        />
      ) : (
        <>
          {/* Workspace selector */}
          <div className="glass rounded-lg p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Seus workspaces</p>
            <div className="flex flex-wrap gap-2">
              {orgs.map((m) => (
                <button
                  key={m.organization_id}
                  onClick={() => setActive(m.organization_id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    activeOrgId === m.organization_id
                      ? "bg-primary/15 border-primary/40 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.15)]"
                      : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {activeOrgId === m.organization_id && <Check className="h-3.5 w-3.5 text-primary" />}
                    <span className="font-medium">{m.organizations.name}</span>
                    <Badge variant="outline" className={`text-[9px] ${ROLE_COLOR[m.role]}`}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {activeOrg && (
            <>
              {/* Members */}
              <div className="glass rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Membros ({members?.length ?? 0})
                  </h3>
                </div>
                <div className="divide-y divide-border/20">
                  {(members ?? []).map((m, i) => {
                    const isOwner = activeOrg.organizations.owner_id === m.user_id;
                    const isMe = m.user_id === user?.id;
                    const displayName = isMe
                      ? "Você"
                      : m.profile?.full_name?.trim() || `${m.user_id.slice(0, 8)}…`;
                    const initials = (m.profile?.full_name || m.user_id).slice(0, 2).toUpperCase();
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 flex-shrink-0 border border-border/40">
                            {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} alt={displayName} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {m.profile?.full_name ? initials : <UserCog className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {displayName}
                              {isMe && <span className="ml-1.5 text-[10px] text-muted-foreground">(você)</span>}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Entrou em {new Date(m.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isOwner && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-primary/15 border-primary/30 text-primary">
                              <Shield className="h-3 w-3" /> Owner
                            </Badge>
                          )}
                          {isAdmin && !isOwner ? (
                            <Select
                              value={m.role}
                              onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as AppRole })}
                            >
                              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="sdr">SDR</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[m.role]}`}>
                              {ROLE_LABEL[m.role]}
                            </Badge>
                          )}
                          {(isAdmin && !isOwner) || isMe ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isOwner}
                              onClick={() => setRemoveTarget({ id: m.id, label: displayName, isMe })}
                              title={isMe ? "Sair do workspace" : "Remover membro"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Invites */}
              {isAdmin && (
                <div className="glass rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-border/40 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      Convites por link
                    </h3>
                    <div className="flex items-center gap-2">
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                        <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="sdr">SDR</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleCreateInvite} disabled={createInvite.isPending} className="gap-1.5 text-xs">
                        {createInvite.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Gerar link
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y divide-border/20">
                    {(invites ?? []).length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Nenhum convite ativo. Gere um link acima.
                      </div>
                    ) : (
                      (invites ?? []).map((inv) => {
                        const expired = new Date(inv.expires_at) < new Date();
                        const used = !!inv.accepted_at;
                        const inactive = inv.revoked || expired || used;
                        return (
                          <div key={inv.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                inactive ? "bg-muted/30" : "bg-primary/10"
                              }`}>
                                <Link2 className={`h-4 w-4 ${inactive ? "text-muted-foreground" : "text-primary"}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[inv.role]}`}>
                                    {ROLE_LABEL[inv.role]}
                                  </Badge>
                                  {used && <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">Aceito</Badge>}
                                  {inv.revoked && <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">Revogado</Badge>}
                                  {expired && !used && !inv.revoked && (
                                    <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30 gap-1">
                                      <AlertCircle className="h-3 w-3" /> Expirado
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                                  {inv.token.slice(0, 16)}… · expira {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!inactive && (
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => copyInviteLink(inv.token)}>
                                  <Copy className="h-3.5 w-3.5" /> Copiar
                                </Button>
                              )}
                              {!inv.revoked && !used && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => revokeInvite.mutate(inv.id)}
                                  title="Revogar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Permissions matrix */}
              <div className="glass rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border/40">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Matriz de permissões
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    O que cada papel pode fazer em cada entidade do sistema.
                  </p>
                </div>
                <div className="p-4">
                  <PermissionsMatrix currentRole={myRole} />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
