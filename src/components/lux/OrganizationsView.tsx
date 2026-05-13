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
import { useAuth } from "@/contexts/AuthContext";
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportInvites}
                        disabled={(filteredInvites?.length ?? 0) === 0}
                        className="gap-1.5 text-xs"
                        title="Exportar lista atual em CSV (auditoria)"
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 border-b border-border/40 bg-secondary/10 flex items-center gap-2 flex-wrap">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <Tabs value={inviteFilter} onValueChange={(v) => setInviteFilter(v as typeof inviteFilter)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="all" className="text-xs h-6 px-2.5">Todos ({invites?.length ?? 0})</TabsTrigger>
                        <TabsTrigger value="pending" className="text-xs h-6 px-2.5">Pendentes ({inviteCounts.pending})</TabsTrigger>
                        <TabsTrigger value="accepted" className="text-xs h-6 px-2.5">Aceitos ({inviteCounts.accepted})</TabsTrigger>
                        <TabsTrigger value="revoked" className="text-xs h-6 px-2.5">Revogados ({inviteCounts.revoked})</TabsTrigger>
                        <TabsTrigger value="expired" className="text-xs h-6 px-2.5">Expirados ({inviteCounts.expired})</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="divide-y divide-border/20">
                    {(invites ?? []).length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Nenhum convite ativo. Gere um link acima.
                      </div>
                    ) : filteredInvites.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Nenhum convite neste filtro.
                      </div>
                    ) : (
                      filteredInvites.map((inv) => {
                        const expired = new Date(inv.expires_at) < new Date();
                        const used = !!inv.accepted_at;
                        const inactive = inv.revoked || expired || used;
                        const fmt = (d: string | null) =>
                          d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
                        const statusLabel = used
                          ? "Aceito"
                          : inv.revoked
                          ? "Revogado"
                          : expired
                          ? "Expirado"
                          : "Pendente";
                        const acceptedName =
                          inv.accepted_by_profile?.full_name?.trim() ||
                          (inv.accepted_by ? `${inv.accepted_by.slice(0, 8)}…` : null);
                        const creatorName =
                          inv.created_by_profile?.full_name?.trim() ||
                          `${inv.created_by.slice(0, 8)}…`;
                        const resends = resendHistory[inv.token] ?? [];
                        const lastResendAt = resends[0]?.at;
                        const relTime = (ms: number) => {
                          const diff = Date.now() - ms;
                          const m = Math.floor(diff / 60000);
                          if (m < 1) return "agora mesmo";
                          if (m < 60) return `há ${m} min`;
                          const h = Math.floor(m / 60);
                          if (h < 24) return `há ${h} h`;
                          const d = Math.floor(h / 24);
                          return `há ${d} d`;
                        };
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
                                  {!used && !inv.revoked && !expired && (
                                    <Badge variant="outline" className="text-[10px] bg-info/15 text-info border-info/30">
                                      Pendente
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-mono truncate">{inv.token.slice(0, 16)}…</p>
                                    {resends.length > 0 && (
                                      <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-medium text-info hover:bg-info/15 focus:outline-none focus:ring-1 focus:ring-info/40"
                                              aria-label={`Reenviado ${resends.length} ${resends.length === 1 ? "vez" : "vezes"}`}
                                            >
                                              <History className="h-2.5 w-2.5" />
                                              {resends.length}× · {lastResendAt ? relTime(lastResendAt) : ""}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" align="start" className="max-w-[260px]">
                                            <p className="text-[11px] font-semibold mb-1">Histórico de reenvios</p>
                                            <ul className="space-y-0.5 text-[10px]">
                                              {resends.slice(0, 5).map((r, i) => (
                                                <li key={`${r.at}-${i}`} className="flex justify-between gap-3">
                                                  <span className="text-muted-foreground">
                                                    {new Date(r.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                                  </span>
                                                  <span className="font-mono opacity-70">{r.newToken.slice(0, 8)}…</span>
                                                </li>
                                              ))}
                                              {resends.length > 5 && (
                                                <li className="text-muted-foreground italic">+{resends.length - 5} mais</li>
                                              )}
                                            </ul>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p>
                                    Criado por <span className="text-foreground/80">{creatorName}</span> em{" "}
                                    <span className="text-foreground/80">{fmt(inv.created_at)}</span>
                                  </p>
                                  {used ? (
                                    <p>
                                      Aceito por{" "}
                                      {inv.accepted_by ? (
                                        <button
                                          type="button"
                                          onClick={() => focusMemberByUserId(inv.accepted_by)}
                                          className="text-success underline-offset-2 hover:underline focus:underline focus:outline-none"
                                          title="Ver membro no workspace"
                                        >
                                          {acceptedName ?? "—"}
                                        </button>
                                      ) : (
                                        <span className="text-success">—</span>
                                      )}
                                      {" "}em <span className="text-foreground/80">{fmt(inv.accepted_at)}</span>
                                    </p>
                                  ) : inv.revoked ? (
                                    <p>Revogado · expiraria em {fmt(inv.expires_at)}</p>
                                  ) : (
                                    <p>
                                      {expired ? "Expirou em " : "Expira em "}
                                      <span className={expired ? "text-warning" : "text-foreground/80"}>
                                        {fmt(inv.expires_at)}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!inactive && (
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => copyInviteLink(inv.token)}>
                                  <Copy className="h-3.5 w-3.5" /> Copiar
                                </Button>
                              )}
                              {!used && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs"
                                  onClick={() => handleResendInvite(inv)}
                                  disabled={createInvite.isPending}
                                  title={inactive ? "Gerar novo link com o mesmo papel" : "Substituir por novo link"}
                                >
                                  {createInvite.isPending
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <RefreshCw className="h-3.5 w-3.5" />}
                                  Reenviar
                                </Button>
                              )}
                              {!inv.revoked && !used && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRevokeTarget(inv)}
                                  disabled={revokingId === inv.id}
                                  title="Revogar convite"
                                  aria-label="Revogar convite"
                                >
                                  {revokingId === inv.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <X className="h-4 w-4" />}
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

              {/* Activity history (in-memory) */}
              {activity.length > 0 && (
                <div className="glass rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-border/40 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Atividade recente desta sessão
                    </h3>
                    <button
                      onClick={() => setActivity([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                  <ul className="divide-y divide-border/20">
                    {activity.map((a) => {
                      const Icon =
                        a.icon === "role" ? UserCog
                        : a.icon === "revoke" ? X
                        : a.icon === "resend" ? RefreshCw
                        : a.icon === "remove" ? Trash2
                        : Activity;
                      const tone =
                        a.icon === "revoke" || a.icon === "remove" ? "text-destructive bg-destructive/10"
                        : a.icon === "role" ? "text-info bg-info/10"
                        : "text-primary bg-primary/10";
                      return (
                        <motion.li
                          key={a.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-3 flex items-start gap-3"
                        >
                          <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${tone}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground">{a.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.detail}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                            {new Date(a.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                  <div className="px-4 py-2 border-t border-border/30 bg-secondary/10 text-[10px] text-muted-foreground">
                    Histórico em memória (limpa ao recarregar). Para auditoria completa, consulte os logs em Configurações.
                  </div>
                </div>
              )}

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
