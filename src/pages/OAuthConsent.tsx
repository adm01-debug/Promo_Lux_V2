import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Tela de consentimento do servidor de autorização OAuth 2.1 do Supabase.
 *
 * Fluxo: um cliente MCP (ChatGPT, Claude, Cursor) inicia a autorização, o
 * Supabase redireciona o usuário para cá com `authorization_id`, e aqui ele
 * aprova ou nega o acesso. O `supabase.auth.oauth` é beta — tipamos localmente
 * apenas os três métodos usados, sem depender de tipos ainda não publicados.
 */
interface AuthorizationClient {
  name?: string;
  client_name?: string;
  logo_uri?: string;
}

interface AuthorizationDetails {
  client?: AuthorizationClient;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
}

interface OAuthNamespace {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
}

function oauthClient(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!authorizationId) {
        setError("Requisição inválida: parâmetro authorization_id ausente.");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserva a URL COMPLETA do consentimento para retornar após o login.
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }

      const { data, error: detailsError } =
        await oauthClient().getAuthorizationDetails(authorizationId);
      if (!active) return;

      if (detailsError) {
        setError(detailsError.message);
        return;
      }

      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();

    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauthClient().approveAuthorization(authorizationId)
      : await oauthClient().denyAuthorization(authorizationId);

    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }

    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um destino de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "o aplicativo";

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="glass border-primary/20">
          {error ? (
            <>
              <CardHeader className="items-center text-center">
                <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
                </div>
                <CardTitle>Não foi possível concluir</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              </CardContent>
            </>
          ) : !details ? (
            <CardContent className="py-12 flex flex-col items-center gap-3" role="status">
              <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Carregando solicitação…</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="items-center text-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <CardTitle>Conectar {clientName} ao LUX IA</CardTitle>
                <CardDescription>
                  {clientName} poderá consultar seus dados do LUX IA agindo como você — com as
                  mesmas permissões e o mesmo isolamento por organização da sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="text-xs text-muted-foreground space-y-1.5 rounded-lg bg-muted/40 p-3">
                  <li>• Consultar empresas e decisores da sua base</li>
                  <li>• Acompanhar jobs de raspagem</li>
                  <li>• Ler métricas consolidadas do dashboard</li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => decide(false)}
                  >
                    Negar
                  </Button>
                  <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Aprovar"}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
