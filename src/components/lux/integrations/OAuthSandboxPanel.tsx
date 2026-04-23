import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { AlertCircle, CheckCircle2, FlaskConical, Loader2, ShieldCheck, Copy, ExternalLink, KeyRound } from "lucide-react";
import { OAuthSnapshotsPanel } from "./OAuthSnapshotsPanel";
import type { SaveSnapshotInput } from "@/hooks/useOAuthSandboxSnapshots";

type Provider = "gmail" | "outlook";
type ScopeType = "user" | "organization";

interface DryRunResult {
  dry_run: true;
  provider: Provider;
  scope_type: ScopeType;
  organization_id: string;
  redirect_uri: string;
  redirect_uri_normalized: string;
  scopes: string[];
  client_id_configured: boolean;
  client_secret_configured: boolean;
  auth_url_preview: string;
  warnings: string[];
}

/**
 * Painel sandbox: valida redirect URI, scopes e permissões antes de
 * disparar o OAuth real. Útil para garantir que clientes em produção
 * estão configurados corretamente nos provedores.
 */
export function OAuthSandboxPanel() {
  const { isAdmin } = usePermissions();
  const [provider, setProvider] = useState<Provider>("gmail");
  const [scopeType, setScopeType] = useState<ScopeType>("user");
  const [redirectUri, setRedirectUri] = useState(
    typeof window !== "undefined" ? `${window.location.origin}/integrations` : "",
  );
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dryRun = useMutation({
    mutationFn: async () => {
      setError(null);
      setResult(null);
      const { data, error } = await supabase.functions.invoke("email-oauth-connect", {
        body: { provider, redirect_uri: redirectUri, scope_type: scopeType, dry_run: true },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Falha");
      return data as DryRunResult;
    },
    onSuccess: (d) => {
      setResult(d);
      toast({ title: "Validação concluída", description: `Configuração ${d.warnings.length === 0 ? "OK" : "com avisos"}.` });
    },
    onError: (e: Error) => {
      setError(e.message);
      toast({ title: "Validação falhou", description: e.message, variant: "destructive" });
    },
  });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: label });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const ok = result && result.client_id_configured && result.client_secret_configured && result.warnings.length === 0 && !error;

  const pendingSnapshot: SaveSnapshotInput | null = result
    ? {
        label: "",
        provider: result.provider,
        scope_type: result.scope_type,
        redirect_uri: result.redirect_uri,
        redirect_uri_normalized: result.redirect_uri_normalized,
        scopes: result.scopes,
        client_id_configured: result.client_id_configured,
        client_secret_configured: result.client_secret_configured,
        warnings: result.warnings,
        auth_url_preview: result.auth_url_preview,
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Sandbox OAuth</h3>
          <Badge variant="outline" className="text-[10px]">dry-run</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Valide redirect URI, scopes solicitados e permissões da sua conta sem iniciar o fluxo real do provedor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Escopo da caixa</Label>
            <Select value={scopeType} onValueChange={(v) => setScopeType(v as ScopeType)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Pessoal (SDR)</SelectItem>
                <SelectItem value="organization" disabled={!isAdmin}>
                  Compartilhada (org){!isAdmin && " · admin"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs">Redirect URI</Label>
            <Input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="https://app.example.com/integrations"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => dryRun.mutate()}
            disabled={dryRun.isPending || !redirectUri}
            className="gap-2"
          >
            {dryRun.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Validar configuração
          </Button>
          {result && (
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 ${ok ? "border-success/30 text-success" : "border-warning/40 text-warning"}`}
            >
              {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
              {ok ? "Pronto para produção" : "Revise os avisos"}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="glass rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Validação falhou</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Client ID</p>
              <Badge variant="outline" className={`mt-1 gap-1 ${result.client_id_configured ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                <KeyRound className="h-2.5 w-2.5" />
                {result.client_id_configured ? "Configurado" : "Ausente"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Client Secret</p>
              <Badge variant="outline" className={`mt-1 gap-1 ${result.client_secret_configured ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                <KeyRound className="h-2.5 w-2.5" />
                {result.client_secret_configured ? "Configurado" : "Ausente"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Escopo</p>
              <p className="font-mono mt-1">{result.scope_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Organização</p>
              <p className="font-mono mt-1 truncate" title={result.organization_id}>{result.organization_id.slice(0, 8)}…</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Redirect URI normalizado</p>
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" onClick={() => copy(result.redirect_uri_normalized, "Redirect URI")}>
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
            <code className="block mt-1 text-[11px] bg-muted/40 rounded px-2 py-1.5 break-all">
              {result.redirect_uri_normalized}
            </code>
            <p className="text-[10px] text-muted-foreground mt-1">
              Cole exatamente este valor em{" "}
              {result.provider === "gmail"
                ? "Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs"
                : "Azure Portal → App Registration → Authentication → Redirect URIs (Web)"}.
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Scopes solicitados ({result.scopes.length})</p>
            <div className="flex flex-wrap gap-1">
              {result.scopes.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
              ))}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
              <p className="text-xs font-medium text-warning flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> Avisos ({result.warnings.length})
              </p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground list-disc list-inside">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">Pré-visualização da auth URL (não navega)</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => copy(result.auth_url_preview, "Auth URL")}>
                <Copy className="h-3 w-3" /> Copiar URL
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[11px]">
                <a href={result.auth_url_preview} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      <OAuthSnapshotsPanel pending={pendingSnapshot} />
    </div>
  );
}