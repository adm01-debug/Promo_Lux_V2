import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Shield, AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ScimPanel() {
  const { activeOrgId } = useActiveOrganization();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const { data: hasToken, refetch } = useQuery({
    queryKey: ["scim-token-status", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return false;
      const { data } = await supabase
        .from("organizations")
        .select("scim_token_hash")
        .eq("id", activeOrgId)
        .single();
      return !!(data as { scim_token_hash?: string | null } | null)?.scim_token_hash;
    },
    enabled: !!activeOrgId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Org nao selecionada");
      const { data, error } = await supabase.rpc("generate_scim_token", {
        p_org_id: activeOrgId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (token) => {
      setNewToken(token);
      setShowToken(true);
      refetch();
      toast.success("Token SCIM gerado! Copie agora — nao sera exibido novamente.");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const scimBaseUrl = `${supabaseUrl}/functions/v1/scim/v2`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
          SCIM 2.0 — Provisionamento Automatico
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Integre com Okta, Azure AD ou outro IdP para provisionar e desprovisionar usuarios automaticamente.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/20">
        {hasToken ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm text-foreground">Token SCIM configurado</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-success/10 text-success border-success/30">
              Ativo
            </Badge>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Nenhum token configurado</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Inativo
            </Badge>
          </>
        )}
      </div>

      {/* Config para o IdP */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-foreground">Configure no seu IdP:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border/20">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">Base URL</span>
            <code className="text-[10px] font-mono text-foreground flex-1 truncate">{scimBaseUrl}</code>
            <button
              onClick={() => copyToClipboard(scimBaseUrl, "URL")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copiar URL base"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border/20">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">Header extra</span>
            <code className="text-[10px] font-mono text-foreground flex-1">
              X-Org-Id: {activeOrgId ?? "seu-org-uuid"}
            </code>
            <button
              onClick={() => copyToClipboard(`X-Org-Id: ${activeOrgId}`, "Header")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copiar header X-Org-Id"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Token gerado */}
      {newToken && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 space-y-2">
          <p className="text-xs font-medium text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Copie agora — o token so e exibido uma vez
          </p>
          <div className="flex items-center gap-2">
            <code className={cn("text-[10px] font-mono text-foreground flex-1 break-all", !showToken && "blur-sm select-none")}>
              {newToken}
            </code>
            <button
              onClick={() => setShowToken((v) => !v)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? "Ocultar token" : "Revelar token"}
            >
              {showToken ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
            <button
              onClick={() => copyToClipboard(newToken, "Token SCIM")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copiar token SCIM"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="gap-2"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", generateMutation.isPending && "animate-spin")} aria-hidden="true" />
        {hasToken ? "Rotacionar Token" : "Gerar Token SCIM"}
      </Button>

      <p className="text-[10px] text-muted-foreground">
        Endpoints suportados: Users (CRUD), ServiceProviderConfig.
        Rotacionar invalida o token anterior imediatamente.
      </p>
    </div>
  );
}
