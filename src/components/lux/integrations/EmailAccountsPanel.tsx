import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Mail, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  display_name: string | null;
  active: boolean;
  last_polled_at: string | null;
  last_error: string | null;
  created_at: string;
}

export function EmailAccountsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState<"gmail" | "outlook" | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["email-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("id,provider,email,display_name,active,last_polled_at,last_error,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
    refetchInterval: 30_000,
  });

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
        body: { provider, code, redirect_uri: redirectUri },
      });
      if (error || data?.error) {
        toast({ title: "Falha ao conectar", description: data?.error ?? error?.message, variant: "destructive" });
      } else {
        toast({ title: "Conta conectada", description: data?.account?.email });
        qc.invalidateQueries({ queryKey: ["email-accounts"] });
      }
    })();
  }, [qc]);

  const connectMutation = useMutation({
    mutationFn: async (provider: "gmail" | "outlook") => {
      setConnecting(provider);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.functions.invoke("email-oauth-connect", {
        body: { provider, redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      sessionStorage.setItem("oauth_provider", provider);
      sessionStorage.setItem("oauth_state", data.state);
      window.location.href = data.url;
    },
    onError: (e: Error) => {
      setConnecting(null);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const pollMutation = useMutation({
    mutationFn: async (accountId: string) => {
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
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta removida" });
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!!connecting} onClick={() => connectMutation.mutate("gmail")} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Conectar Gmail
        </Button>
        <Button size="sm" variant="outline" disabled={!!connecting} onClick={() => connectMutation.mutate("outlook")} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Conectar Outlook
        </Button>
        <p className="text-[11px] text-muted-foreground ml-auto">
          Replies são sincronizados automaticamente a cada 5 minutos.
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
          {accounts.map((acc) => (
            <div key={acc.id} className="glass rounded-lg p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{acc.email}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{acc.provider}</Badge>
                  {acc.last_error ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30"><AlertCircle className="h-2.5 w-2.5" />Erro</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30"><CheckCircle2 className="h-2.5 w-2.5" />Ativa</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {acc.last_polled_at ? `Última sync: ${new Date(acc.last_polled_at).toLocaleString("pt-BR")}` : "Aguardando primeira sync"}
                  {acc.last_error && <span className="text-destructive ml-2">· {acc.last_error.slice(0, 80)}</span>}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => pollMutation.mutate(acc.id)} disabled={pollMutation.isPending}>
                <RefreshCw className={`h-3 w-3 ${pollMutation.isPending ? "animate-spin" : ""}`} /> Sincronizar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => removeMutation.mutate(acc.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}