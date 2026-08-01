import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Users, Link2, Copy, Trash2, Shield, UserCog, Check, Loader2, AlertCircle, X, Filter, RefreshCw, History, Undo2, Activity, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  useMyOrganizations, useActiveOrganization, useOrgMembers, useOrgInvites,
  useCreateOrganization, useCreateInvite, useRevokeInvite,
  useUpdateMemberRole, useRemoveMember, type AppRole,
} from "@/hooks/useOrganizations";
import { EmptyState } from "@/components/lux/EmptyState";
import { DataError } from "@/components/lux/DataError";
import { PermissionsMatrix } from "@/components/lux/permissions/PermissionsMatrix";
import { MembershipAuditLog } from "@/components/lux/organizations/MembershipAuditLog";
import { MemberRow } from "@/components/lux/organizations/MemberRow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCSV } from "@/lib/exportCSV";
import { WorkspaceSelector } from "./organizations/WorkspaceSelector";
import { InviteSection } from "./organizations/InviteSection";
import { ActivityHistory } from "./organizations/ActivityHistory";

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
  const [memberFilter, setMemberFilter] = useState<"all" | "active">("all");
  const [inviteFilter, setInviteFilter] = useState<"all" | "pending" | "accepted" | "revoked" | "expired">("all");
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; role: AppRole; token: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Histórico local de reenvios por token original do convite.
  // Mantido em localStorage por organização, pois o backend não persiste essa relação.
  type ResendEntry = { at: number; newToken: string };
  type ResendHistory = Record<string, ResendEntry[]>;
  const resendStorageKey = activeOrgId ? `lux:invite-resends:${activeOrgId}` : null;
  const [resendHistory, setResendHistory] = useState<ResendHistory>({});
  useEffect(() => {
    if (!resendStorageKey) { setResendHistory({}); return; }
    try {
      const raw = localStorage.getItem(resendStorageKey);
      setResendHistory(raw ? JSON.parse(raw) : {});
    } catch {
      setResendHistory({});
    }
  }, [resendStorageKey]);
  const recordResend = (originalToken: string, newToken: string) => {
    if (!resendStorageKey) return;
    setResendHistory(prev => {
      const next = { ...prev };
      const list = next[originalToken] ? [...next[originalToken]] : [];
      list.unshift({ at: Date.now(), newToken });
      next[originalToken] = list.slice(0, 10);
      try { localStorage.setItem(resendStorageKey, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  type ActivityEntry = {
    id: string;
    at: number;
    icon: "role" | "revoke" | "resend" | "remove" | "create";
    title: string;
    detail: string;
  };
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const pushActivity = (entry: Omit<ActivityEntry, "id" | "at">) => {
    setActivity(prev => [
      { id: crypto.randomUUID(), at: Date.now(), ...entry },
      ...prev,
    ].slice(0, 12));
  };

  // Quando clicado em "Aceito por X" num convite, destacamos a linha
  // do membro correspondente na lista acima e fazemos scroll até ela.
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null);
  const focusMemberByUserId = (userId: string | null) => {
    if (!userId) return;
    const member = (members ?? []).find((m) => m.user_id === userId);
    if (!member) {
      toast({
        title: "Usuário não está mais neste workspace",
        description: "O membro pode ter saído ou sido removido.",
      });
      return;
    }
    setHighlightedMemberId(member.id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`org-member-${member.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setHighlightedMemberId((id) => (id === member.id ? null : id)), 2400);
  };

  const myMembership = (members ?? []).find(m => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "admin";
  const myRole = (myMembership?.role as AppRole | undefined) ?? null;

  const filteredMembers = (members ?? []).filter(() => {
    // All current members are "active" — placeholder for future suspended state.
    return memberFilter === "all" || memberFilter === "active";
  });

  const now = new Date();
  const inviteCounts = (invites ?? []).reduce(
    (acc, inv) => {
      const expired = new Date(inv.expires_at) < now;
      const used = !!inv.accepted_at;
      if (inv.revoked) acc.revoked++;
      else if (used) acc.accepted++;
      else if (expired) acc.expired++;
      else acc.pending++;
      return acc;
    },
    { pending: 0, accepted: 0, revoked: 0, expired: 0 }
  );

  const filteredInvites = (invites ?? []).filter((inv) => {
    if (inviteFilter === "all") return true;
    const expired = new Date(inv.expires_at) < now;
    const used = !!inv.accepted_at;
    if (inviteFilter === "revoked") return inv.revoked;
    if (inviteFilter === "accepted") return !inv.revoked && used;
    if (inviteFilter === "expired") return !inv.revoked && !used && expired;
    if (inviteFilter === "pending") return !inv.revoked && !used && !expired;
    return true;
  });

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

  const handleResendInvite = async (inv: { id: string; role: AppRole; revoked: boolean; accepted_at: string | null; token: string }) => {
    try {
      // Generate a fresh invite with the same role
      const created = await createInvite.mutateAsync({ role: inv.role });
      // Revoke the previous one if it was still pending (not accepted, not already revoked)
      if (!inv.revoked && !inv.accepted_at) {
        try { await revokeInvite.mutateAsync(inv.id); } catch { /* non-blocking */ }
      }
      // Registrar no histórico local de reenvios (chaveado pelo token original).
      recordResend(inv.token, created.token);
      const url = `${window.location.origin}/invite/${created.token}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Convite reenviado",
        description: "Novo link gerado e copiado para a área de transferência.",
      });
      pushActivity({
        icon: "resend",
        title: "Convite reenviado",
        detail: `Novo link ${ROLE_LABEL[inv.role]} gerado (anterior revogado).`,
      });
    } catch (e) {
      toast({ title: "Erro ao reenviar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleExportInvites = () => {
    const list = filteredInvites ?? [];
    if (list.length === 0) {
      toast({ title: "Nada para exportar", description: "Nenhum convite no filtro atual.", variant: "destructive" });
      return;
    }
    const now = new Date();
    const rows = list.map((inv) => {
      const expired = new Date(inv.expires_at) < now;
      const used = !!inv.accepted_at;
      const status = used ? "aceito" : inv.revoked ? "revogado" : expired ? "expirado" : "pendente";
      const resends = resendHistory[inv.token] ?? [];
      return {
        token: inv.token,
        role: ROLE_LABEL[inv.role],
        status,
        criado_por_nome: inv.created_by_profile?.full_name?.trim() ?? "",
        criado_por_id: inv.created_by,
        criado_em: new Date(inv.created_at).toISOString(),
        expira_em: new Date(inv.expires_at).toISOString(),
        aceito_por_nome: inv.accepted_by_profile?.full_name?.trim() ?? "",
        aceito_por_id: inv.accepted_by ?? "",
        aceito_em: inv.accepted_at ? new Date(inv.accepted_at).toISOString() : "",
        revogado: inv.revoked ? "sim" : "nao",
        reenvios: resends.length,
        ultimo_reenvio_em: resends[0] ? new Date(resends[0].at).toISOString() : "",
      };
    });
    const orgSlug = activeOrg?.organizations.slug ?? "workspace";
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCSV(rows, `convites-${orgSlug}-${stamp}.csv`);
    toast({ title: "CSV exportado", description: `${rows.length} convite${rows.length === 1 ? "" : "s"} no arquivo.` });
  };

  const handleRoleChange = async (
    member: { id: string; role: AppRole; user_id: string; profile?: { full_name: string | null } | null },
    newRole: AppRole
  ) => {
    if (member.role === newRole) return;
    const previousRole = member.role;
    const label = member.user_id === user?.id
      ? "Você"
      : member.profile?.full_name?.trim() || `${member.user_id.slice(0, 8)}…`;
    try {
      await updateRole.mutateAsync({ id: member.id, role: newRole });
      toast({
        title: "Papel atualizado",
        description: `${label}: ${ROLE_LABEL[previousRole]} → ${ROLE_LABEL[newRole]}`,
        action: (
          <button
            onClick={() => handleRoleChange({ ...member, role: newRole }, previousRole)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Undo2 className="h-3 w-3" /> Desfazer
          </button>
        ) as unknown as undefined,
      });
      pushActivity({
        icon: "role",
        title: "Papel alterado",
        detail: `${label}: ${ROLE_LABEL[previousRole]} → ${ROLE_LABEL[newRole]}`,
      });
    } catch (e) {
      toast({
        title: "Falha ao alterar papel",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleRevokeInvite = async (inv: { id: string; role: AppRole; token: string }) => {
    setRevokingId(inv.id);
    try {
      await revokeInvite.mutateAsync(inv.id);
      toast({
        title: "Convite revogado",
        description: `Link ${ROLE_LABEL[inv.role]} (${inv.token.slice(0, 8)}…) não pode mais ser usado.`,
      });
      pushActivity({
        icon: "revoke",
        title: "Convite revogado",
        detail: `${ROLE_LABEL[inv.role]} · token ${inv.token.slice(0, 8)}…`,
      });
      setRevokeTarget(null);
    } catch (e) {
      toast({
        title: "Falha ao revogar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
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
          <WorkspaceSelector orgs={orgs} activeOrgId={activeOrgId} setActive={setActive} />

          {activeOrg && (
            <>
              {/* Members */}
              <div className="glass rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Membros ({members?.length ?? 0})
                  </h3>
                  <Tabs value={memberFilter} onValueChange={(v) => setMemberFilter(v as typeof memberFilter)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs h-6 px-2.5">Todos ({members?.length ?? 0})</TabsTrigger>
                      <TabsTrigger value="active" className="text-xs h-6 px-2.5">Ativos ({members?.length ?? 0})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="divide-y divide-border/20">
                  {filteredMembers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Nenhum membro neste filtro.</div>
                    ) : filteredMembers.map((m, i) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        isOwner={activeOrg.organizations.owner_id === m.user_id}
                        isMe={m.user_id === user?.id}
                        isAdmin={isAdmin}
                        highlightedMemberId={highlightedMemberId}
                        index={i}
                        onRoleChange={handleRoleChange}
                        onRemove={(member) => setRemoveTarget({ id: member.id, label: member.user_id === user?.id ? "Você" : member.profile?.full_name?.trim() || `${member.user_id.slice(0, 8)}…`, isMe: member.user_id === user?.id })}
                      />
                    ))}
                </div>
              </div>

              {/* Invites */}
              {isAdmin && (
                <InviteSection
                  invites={invites ?? []}
                  inviteRole={inviteRole}
                  setInviteRole={setInviteRole}
                  inviteFilter={inviteFilter}
                  setInviteFilter={setInviteFilter}
                  handleCreateInvite={handleCreateInvite}
                  handleExportInvites={handleExportInvites}
                  createInvitePending={createInvite.isPending}
                  filteredInvites={filteredInvites}
                  inviteCounts={inviteCounts}
                  resendHistory={resendHistory}
                  focusMemberByUserId={focusMemberByUserId}
                  copyInviteLink={copyInviteLink}
                  handleResendInvite={handleResendInvite}
                  setRevokeTarget={setRevokeTarget}
                  revokingId={revokingId}
                />
              )}

              <ActivityHistory activity={activity} onClear={() => setActivity([])} />

              {/* Persistent membership audit log (admins only) */}
              {isAdmin && (
                <MembershipAuditLog orgId={activeOrgId} currentUserId={user?.id ?? null} />
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

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget?.isMe ? "Sair do workspace?" : "Remover membro?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.isMe
                ? `Você perderá acesso a "${activeOrg?.organizations.name}" e a todos os dados deste workspace. Você pode ser convidado novamente por um admin.`
                : `${removeTarget?.label} perderá acesso a este workspace imediatamente. Esta ação pode ser desfeita gerando um novo convite.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removeTarget) return;
                removeMember.mutate(removeTarget.id, {
                  onSuccess: () => {
                    toast({
                      title: removeTarget.isMe ? "Você saiu do workspace" : "Membro removido",
                    });
                    pushActivity({
                      icon: "remove",
                      title: removeTarget.isMe ? "Saída do workspace" : "Membro removido",
                      detail: removeTarget.label,
                    });
                  },
                  onError: (e) => {
                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                  },
                });
                setRemoveTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeTarget?.isMe ? "Sair" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && !revokingId && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar este convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link <span className="font-mono text-foreground/80">{revokeTarget?.token.slice(0, 12)}…</span>{" "}
              ({revokeTarget ? ROLE_LABEL[revokeTarget.role] : ""}) deixará de funcionar imediatamente.
              Quem ainda não aceitou não conseguirá entrar pelo link. Esta ação não pode ser desfeita —
              gere um novo convite se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!revokingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!revokingId}
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) handleRevokeInvite(revokeTarget);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {revokingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
