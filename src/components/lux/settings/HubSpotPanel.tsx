import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/contexts/active-org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function HubSpotPanel() {
  const { activeOrgId } = useActiveOrganization();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["hubspot-integration", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;
      const { data } = await supabase
        .from("org_integrations")
        .select("id, enabled, last_synced_at, config")
        .eq("organization_id", activeOrgId)
        .eq("provider", "hubspot")
        .maybeSingle();
      return data as { id: string; enabled: boolean; last_synced_at: string | null; config: { api_key?: string } } | null;
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Org nao selecionada");
      if (!apiKey.trim()) throw new Error("API Key nao pode ser vazia");

      const { error } = await supabase
        .from("org_integrations")
        .upsert(
          {
            organization_id: activeOrgId,
            provider: "hubspot",
            config: { api_key: apiKey.trim() },
            enabled: true,
          },
          { onConflict: "organization_id,provider" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubspot-integration", activeOrgId] });
      setApiKey("");
      toast.success("HubSpot configurado!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Nao autenticado");
      const res = await supabase.functions.invoke("hubspot-sync", {
        body: { org_id: activeOrgId },
      });
      if (res.error) throw res.error;
      return res.data as { companies_synced: number; created: number; updated: number; failed: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["hubspot-integration", activeOrgId] });
      toast.success(
        `Sincronizado: ${data.companies_synced} empresas (${data.created} criadas, ${data.updated} atualizadas, ${data.failed} falhas)`
      );
    },
    onError: (err: Error) => toast.error(`Erro de sincronizacao: ${err.message}`),
  });

  const isConfigured = !!(integration?.config?.api_key);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🧡</span>
          <div>
            <p className="text-sm font-medium text-foreground">HubSpot CRM</p>
            <p className="text-xs text-muted-foreground">Sincroniza empresas e deals para o HubSpot</p>
          </div>
        </div>
        {isConfigured ? (
          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
            Conectado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Nao configurado
          </Badge>
        )}
      </div>

      {isConfigured && integration?.last_synced_at && (
        <p className="text-xs text-muted-foreground">
          Ultima sincronizacao: {new Date(integration.last_synced_at).toLocaleString("pt-BR")}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="hubspot-api-key" className="text-xs font-medium text-foreground">
          {isConfigured ? "Rotacionar API Key (Private App)" : "API Key (Private App)"}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="hubspot-api-key"
              type={showKey ? "text" : "password"}
              placeholder={isConfigured ? "••••••••••••••••" : "pat-na1-xxxxxxxx-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-xs pr-8"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
            >
              {showKey ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !apiKey.trim()}
            className="shrink-0"
          >
            Salvar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Crie uma Private App no HubSpot com escopo <code>crm.objects.companies.write</code> e cole a chave acima.
        </p>
      </div>

      {isConfigured && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} aria-hidden="true" />
          Sincronizar agora
        </Button>
      )}
    </div>
  );
}
