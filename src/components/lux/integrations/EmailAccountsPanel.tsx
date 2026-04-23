import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Mail, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2, User as UserIcon, Building2, KeyRound, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { DisconnectAccountDialog } from "./DisconnectAccountDialog";

interface Account {
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  display_name: string | null;
  active: boolean;
  last_polled_at: string | null;
  last_error: string | null;
  created_at: string;
  scope_type: "user" | "organization";
  user_id: string;
}

/** Identifica erros que exigem reconexão OAuth (refresh token expirado/revogado). */
function isAuthError(err: string | null): boolean {
  if (!err) return false;
  const e = err.toLowerCase();
  return (
    e.includes("invalid_grant") ||
    e.includes("invalid_token") ||
    e.includes("token_expired") ||
    e.includes("refresh") ||
    e.includes("unauthorized") ||
    e.includes("401") ||
    e.includes("403") ||
    e.includes("revoked") ||
    e.includes("reconnect")
  );
}

function classifyError(err: string | null): "auth" | "sync" | null {
  if (!err) return null;
  return isAuthError(err) ? "auth" : "sync";
}

export function EmailAccountsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState<"gmail" | "outlook" | null>(null);
  const [scopeType, setScopeType] = useState<"user" | "organization">("user");
  const { isAdmin } = usePermissions();
  const notifiedErrorsRef = useRef<Map<string, string>>(new Map());
  const [disconnectTarget, setDisconnectTarget] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["email-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("id,provider,email,display_name,active,last_polled_at,last_error,created_at,scope_type,user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
    refetchInterval: 30_000,
  });

  // Notifica via toast quando aparecer um novo erro em uma conta
  useEffect(() => {
    accounts.forEach((acc) => {
      const prev = notifiedErrorsRef.current.get(acc.id);
      if (acc.last_error && acc.last_error !== prev) {
        const kind = classifyError(acc.last_error);
        if (kind === "auth") {
          toast({
            title: "Reconexão necessária",
            description: `${acc.email}: token expirado ou revogado. Reconecte para retomar a sincronização.`,
            variant: "destructive",
            action: (
              <button
                onClick={() => connectMutation.mutate(acc.provider)}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Link2 className="h-3 w-3" /> Reconectar
              </button>
            ),
          });
        } else {
          toast({
            title: "Falha na sincronização",
            description: `${acc.email}: ${acc.last_error.slice(0, 120)}`,
            variant: "destructive",
          });
        }
        notifiedErrorsRef.current.set(acc.id, acc.last_error);
      } else if (!acc.last_error && prev) {
        notifiedErrorsRef.current.delete(acc.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Trata retorno do callback OAuth via query string
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const provider = sessionStorage.getItem("oauth_provider") as "gmail" | "outlook" | null;
    const expectedState = sessionStorage.getItem("oauth_state");
    if (!code || !provider || !state || state !== expectedState) return;

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    sessionStorage.removeItem("oauth_provider");
    sessionStorage.removeItem("oauth_state");
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("scope");
    window.history.replaceState({}, "", url.toString());

    (async () => {
      const { data, error } = await supabase.functions.invoke("email-oauth-callback", {
        body: { provider, code, redirect_uri: redirectUri, state },
      });
      if (error || data?.error) {
        toast({ title: "Falha ao conectar", description: data?.error ?? error?.message, variant: "destructive" });
      } else {
        const scope = data?.account?.scope_type === "organization" ? "compartilhada" : "pessoal";
        toast({ title: "Conta conectada", description: `${data?.account?.email} (${scope})` });
        qc.invalidateQueries({ queryKey: ["email-accounts"] });
      }
    })();
  }, [qc]);

  const connectMutation = useMutation({
    mutationFn: async (provider: "gmail" | "outlook") => {
      if (scopeType === "organization" && !isAdmin) {
        throw new Error("Apenas administradores podem conectar caixas compartilhadas (scope organization).");
      }
      setConnecting(provider);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.functions.invoke("email-oauth-connect", {
        body: { provider, redirect_uri: redirectUri, scope_type: scopeType },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      sessionStorage.setItem("oauth_provider", provider);
      sessionStorage.setItem("oauth_state", data.state);
      window.location.href = data.url;
    },
    onError: (e: Error) => {
      setConnecting(null);
      toast({ title: "Permissão negada", description: e.message, variant: "destructive" });
    },
  });

  const pollMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const target = accounts.find((a) => a.id === accountId);
      if (target?.scope_type === "organization" && !isAdmin) {
        throw new Error("Apenas administradores podem sincronizar caixas compartilhadas da organização.");
      }
      const { data, error } = await supabase.functions.invoke("email-poll-replies", {
        body: { account_id: accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast({ title: "Polling concluído", description: `${JSON.stringify(d?.results?.[0] ?? {})}` });
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (e: Error) => toast({ title: "Permissão negada", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Banner agregando contas com erro */}
      {(() => {
        const failing = accounts.filter((a) => a.last_error);
        if (failing.length === 0) return null;
        const authFailing = failing.filter((a) => isAuthError(a.last_error));
        const syncFailing = failing.filter((a) => !isAuthError(a.last_error));
        return (
          <div className="glass rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  {failing.length === 1
                    ? "1 caixa com problemas"
                    : `${failing.length} caixas com problemas`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {authFailing.length > 0 && (
                    <span>
                      {authFailing.length} {authFailing.length === 1 ? "precisa" : "precisam"} de reconexão
                      {syncFailing.length > 0 && " · "}
                    </span>
                  )}
                  {syncFailing.length > 0 && (
                    <span>
                      {syncFailing.length} {syncFailing.length === 1 ? "com erro" : "com erros"} de sincronização
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {authFailing.slice(0, 3).map((a) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={!!connecting}
                      onClick={() => connectMutation.mutate(a.provider)}
                    >
                      <Link2 className="h-3 w-3" /> Reconectar {a.email}
                    </Button>
                  ))}
                  {authFailing.length > 3 && (
                    <span className="text-[11px] text-muted-foreground self-center">
                      +{authFailing.length - 3} outras
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={scopeType} onValueChange={(v) => setScopeType(v as "user" | "organization")}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">
              <div className="flex items-center gap-2"><UserIcon className="h-3 w-3" /> Caixa pessoal (SDR)</div>
            </SelectItem>
            <SelectItem value="organization" disabled={!isAdmin}>
              <div className="flex items-center gap-2"><Building2 className="h-3 w-3" /> Caixa compartilhada (org){!isAdmin && " · admin"}</div>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!!connecting} onClick={() => connectMutation.mutate("gmail")} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Conectar Gmail
        </Button>
        <Button size="sm" variant="outline" disabled={!!connecting} onClick={() => connectMutation.mutate("outlook")} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Conectar Outlook
        </Button>
        <p className="text-[11px] text-muted-foreground ml-auto">
          {scopeType === "organization"
            ? "Caixa visível a toda a organização — apenas admins gerenciam."
            : "Caixa visível apenas para você."}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : accounts.length === 0 ? (
        <div className="glass rounded-lg p-6 text-center">
          <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground">Nenhuma caixa conectada</p>
          <p className="text-xs text-muted-foreground mt-1">Conecte uma caixa para detectar replies das suas campanhas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const isOrgScoped = acc.scope_type === "organization";
            const canManage = !isOrgScoped || isAdmin;
            const lockReason = "Apenas administradores gerenciam caixas compartilhadas.";
            const blockedToast = () =>
              toast({ title: "Permissão negada", description: lockReason, variant: "destructive" });
            return (
            <div key={acc.id} className="glass rounded-lg p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{acc.email}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{acc.provider}</Badge>
                  {acc.scope_type === "organization" ? (
                    <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                      <Building2 className="h-2.5 w-2.5" /> Compartilhada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <UserIcon className="h-2.5 w-2.5" /> Pessoal
                    </Badge>
                  )}
                  {acc.last_error ? (
                    isAuthError(acc.last_error) ? (
                      <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30">
                        <KeyRound className="h-2.5 w-2.5" /> Token expirado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30">
                        <AlertCircle className="h-2.5 w-2.5" /> Erro de sync
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30"><CheckCircle2 className="h-2.5 w-2.5" />Ativa</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {acc.last_polled_at ? `Última sync: ${new Date(acc.last_polled_at).toLocaleString("pt-BR")}` : "Aguardando primeira sync"}
                  {acc.last_error && <span className="text-destructive ml-2">· {acc.last_error.slice(0, 80)}</span>}
                  {!canManage && <span className="ml-2 text-warning">· somente leitura</span>}
                </p>
              </div>
              {acc.last_error && isAuthError(acc.last_error) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={!!connecting || !canManage}
                  title={!canManage ? lockReason : undefined}
                  onClick={() => (canManage ? connectMutation.mutate(acc.provider) : blockedToast())}
                >
                  <Link2 className="h-3 w-3" /> Reconectar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => (canManage ? pollMutation.mutate(acc.id) : blockedToast())}
                disabled={pollMutation.isPending || !canManage}
                title={!canManage ? lockReason : undefined}
              >
                <RefreshCw className={`h-3 w-3 ${pollMutation.isPending ? "animate-spin" : ""}`} /> Sincronizar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() => (canManage ? setDisconnectTarget(acc) : blockedToast())}
                disabled={!canManage}
                title={!canManage ? lockReason : "Desconectar e revogar tokens"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            );
          })}
        </div>
      )}

      <DisconnectAccountDialog
        account={disconnectTarget}
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      />
    </div>
  );
}