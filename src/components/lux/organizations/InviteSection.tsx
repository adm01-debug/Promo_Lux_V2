import { 
  Link2, Plus, Download, Loader2, Filter, AlertCircle, 
  History, RefreshCw, Copy, X 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AppRole, type Invite } from "@/hooks/useOrganizations";

export type InviteFilter = "all" | "pending" | "accepted" | "revoked" | "expired";
export interface ResendEntry {
  at: number;
  newToken: string;
}

const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", sdr: "SDR", viewer: "Viewer" };
const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

interface InviteSectionProps {
  invites: Invite[];
  inviteRole: AppRole;
  setInviteRole: (role: AppRole) => void;
  inviteFilter: InviteFilter;
  setInviteFilter: (filter: InviteFilter) => void;
  handleCreateInvite: () => void;
  handleExportInvites: () => void;
  createInvitePending: boolean;
  filteredInvites: Invite[];
  inviteCounts: { pending: number; accepted: number; revoked: number; expired: number };
  resendHistory: Record<string, ResendEntry[]>;
  focusMemberByUserId: (userId: string | null) => void;
  copyInviteLink: (token: string) => void;
  handleResendInvite: (inv: Invite) => void;
  setRevokeTarget: (inv: Invite) => void;
  revokingId: string | null;
}

export const InviteSection = ({
  invites,
  inviteRole,
  setInviteRole,
  inviteFilter,
  setInviteFilter,
  handleCreateInvite,
  handleExportInvites,
  createInvitePending,
  filteredInvites,
  inviteCounts,
  resendHistory,
  focusMemberByUserId,
  copyInviteLink,
  handleResendInvite,
  setRevokeTarget,
  revokingId,
}: InviteSectionProps) => {
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

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
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
          <Button size="sm" onClick={handleCreateInvite} disabled={createInvitePending} className="gap-1.5 text-xs">
            {createInvitePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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
        <Tabs value={inviteFilter} onValueChange={(v) => setInviteFilter(v as InviteFilter)}>
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
        {invites.length === 0 ? (
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
            const acceptedName =
              inv.accepted_by_profile?.full_name?.trim() ||
              (inv.accepted_by ? `${inv.accepted_by.slice(0, 8)}…` : null);
            const creatorName =
              inv.created_by_profile?.full_name?.trim() ||
              `${inv.created_by.slice(0, 8)}…`;
            const resends = resendHistory[inv.token] ?? [];
            const lastResendAt = resends[0]?.at;

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
                      <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[inv.role as AppRole]}`}>
                        {ROLE_LABEL[inv.role as AppRole]}
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
                                  {resends.slice(0, 5).map((r: any, i: number) => (
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
                      disabled={createInvitePending}
                      title={inactive ? "Gerar novo link com o mesmo papel" : "Substituir por novo link"}
                    >
                      {createInvitePending
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
  );
};
