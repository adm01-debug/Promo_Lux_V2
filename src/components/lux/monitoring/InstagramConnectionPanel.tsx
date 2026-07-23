import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  ExternalLink,
  Loader2,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProviderStatus {
  provider: "hikerapi" | "brightdata" | "apify";
  label: string;
  configured: boolean;
  mock_mode?: boolean;
  reachable?: boolean;
  latency_ms?: number;
  http_status?: number;
  error?: string;
  hint: string;
}

interface StatusResponse {
  checked_at: string;
  primary_provider: string | null;
  providers: ProviderStatus[];
}

const PROVIDER_DOCS: Record<string, { url: string; where: string }> = {
  hikerapi: {
    url: "https://hikerapi.com/",
    where: "Painel HikerAPI → API Keys. Copie a chave e salve em Secrets como HIKER_API_KEY.",
  },
  brightdata: {
    url: "https://brightdata.com/cp/setting/users",
    where: "Bright Data → Account Settings → API tokens. Salve em Secrets como BRIGHTDATA_API_TOKEN.",
  },
  apify: {
    url: "https://console.apify.com/account/integrations",
    where: "Apify Console → Integrations. Salve em Secrets como APIFY_API_KEY (ou conecte via Connectors).",
  },
};

function StatusBadge({ p }: { p: ProviderStatus }) {
  if (!p.configured && !p.mock_mode) {
    return (
      <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground">
        <Key className="h-3 w-3" /> Não configurado
      </Badge>
    );
  }
  if (p.mock_mode && !p.configured) {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500/40 text-yellow-500">
        <Info className="h-3 w-3" /> Mock mode
      </Badge>
    );
  }
  if (p.reachable) {
    return (
      <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/30">
        <CheckCircle2 className="h-3 w-3" /> Conectado
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" /> Falha
    </Badge>
  );
}

export function InstagramConnectionPanel() {
  const { data, isLoading, isFetching, refetch, error } = useQuery<StatusResponse>({
    queryKey: ["instagram-connection-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-connection-status");
      if (error) throw error;
      return data as StatusResponse;
    },
    refetchInterval: 60_000,
  });

  const providers = data?.providers ?? [];
  const hasAny = providers.some((p) => p.configured || p.mock_mode);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Conexão do Motor de Instagram
          </h2>
          <p className="text-sm text-muted-foreground">
            Verifique a saúde dos provedores de raspagem do Instagram e teste as credenciais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.checked_at && (
            <span className="text-xs text-muted-foreground">
              Última verificação: {format(new Date(data.checked_at), "dd/MM HH:mm:ss", { locale: ptBR })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Testar credenciais"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Testar credenciais
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao consultar status</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !hasAny && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nenhum provedor configurado</AlertTitle>
          <AlertDescription>
            Configure ao menos um provedor abaixo. O motor padrão é a HikerAPI (custo-benefício), com Bright Data como
            alternativa premium.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          [1, 2, 3].map((i) => <div key={i} className="h-56 glass rounded-xl animate-pulse" />)}

        {providers.map((p) => {
          const docs = PROVIDER_DOCS[p.provider];
          const isPrimary = data?.primary_provider === p.provider;
          return (
            <Card key={p.provider} className="glass">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {p.label}
                      {isPrimary && (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                          Primário
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {p.provider === "hikerapi" && "Raspagem via HikerAPI (endpoint v2/user/by/username)"}
                      {p.provider === "brightdata" && "Datasets do painel Bright Data"}
                      {p.provider === "apify" && "Actors da plataforma Apify"}
                    </CardDescription>
                  </div>
                  <StatusBadge p={p} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-secondary/30">
                    <div className="text-muted-foreground">HTTP</div>
                    <div className="font-mono font-semibold">{p.http_status ?? "—"}</div>
                  </div>
                  <div className="p-2 rounded bg-secondary/30">
                    <div className="text-muted-foreground">Latência</div>
                    <div className="font-mono font-semibold">
                      {p.latency_ms != null ? `${p.latency_ms} ms` : "—"}
                    </div>
                  </div>
                </div>

                {p.error && (
                  <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive font-mono text-[10px]">
                    {p.error}
                  </div>
                )}

                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="text-muted-foreground font-medium">Como configurar</div>
                  <p className="text-foreground/80">{docs.where}</p>
                  <p className="text-muted-foreground/80">{p.hint}</p>
                  <a
                    href={docs.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir painel do provedor <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Onde salvar as chaves
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            As credenciais são armazenadas como <strong>Secrets do backend</strong> e ficam disponíveis para as Edge
            Functions <code className="text-primary">instagram-worker</code> e{" "}
            <code className="text-primary">instagram-enqueue</code>. Nomes esperados:
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono">
            <li>HIKER_API_KEY — chave da HikerAPI (recomendado)</li>
            <li>HIKER_MOCK_MODE — defina como &quot;true&quot; para simular respostas em desenvolvimento</li>
            <li>BRIGHTDATA_API_TOKEN — token do Bright Data (fallback premium)</li>
            <li>APIFY_API_KEY — token do Apify (opcional)</li>
          </ul>
          <p>Após salvar, clique em <strong>Testar credenciais</strong> para revalidar a conexão.</p>
        </CardContent>
      </Card>
    </div>
  );
}
