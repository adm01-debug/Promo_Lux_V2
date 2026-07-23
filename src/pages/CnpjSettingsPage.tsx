import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCnpjAutoEnrichSetting } from "@/hooks/useCnpjAutoEnrichSetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, KeyRound, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

interface StatusResponse {
  hasKey: boolean;
  source: "cnpja" | "cnpja_open";
  limitPerMinute: number;
  cache: { total: number; success: number; not_found: number };
  rate: { windowStart: string; requestCount: number; limit: number } | null;
  queue: { pending: number; processing: number; completed: number; failed: number; not_found: number };
}

export default function CnpjSettingsPage() {
  const { enabled, setEnabled } = useCnpjAutoEnrichSetting();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke<StatusResponse>("cnpj-settings-status");
    if (err) setError(err.message);
    else setStatus(data ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Enriquecimento por CNPJ</h1>
        <p className="text-sm text-muted-foreground">
          Configure as credenciais do CNPJá e o comportamento padrão de enriquecimento automático.
        </p>
      </header>

      {/* Credencial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Credencial do CNPJá
          </CardTitle>
          <CardDescription>
            Sem a chave privada, o sistema opera pelo endpoint aberto com limite de <b>5 consultas/min</b>.
            Configurando a chave, o limite passa para o plano contratado (padrão 60/min).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          ) : status ? (
            <div className="flex flex-wrap items-center gap-3">
              {status.hasKey ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Chave configurada
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                  <AlertCircle className="mr-1 h-3.5 w-3.5" /> Sem chave privada
                </Badge>
              )}
              <Badge variant="secondary">Endpoint: {status.source === "cnpja" ? "api.cnpja.com" : "open.cnpja.com"}</Badge>
              <Badge variant="secondary">
                <Zap className="mr-1 h-3.5 w-3.5" /> Limite: {status.limitPerMinute}/min
              </Badge>
              <Button variant="ghost" size="sm" onClick={load} className="ml-auto">
                <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
              </Button>
            </div>
          ) : null}

          <div className="rounded-md border border-border/50 bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">Como configurar a chave</p>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Obtenha uma chave em <span className="font-mono">cnpja.com</span> (menu Minha conta → API).</li>
              <li>
                Peça ao assistente:{" "}
                <span className="font-mono bg-background/60 px-1.5 py-0.5 rounded">
                  "salve minha chave CNPJá como CNPJA_API_KEY"
                </span>
                . Um formulário seguro será aberto para você colar o valor.
              </li>
              <li>Volte a esta tela e clique em <b>Atualizar</b> para confirmar o status.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              A chave nunca sai do backend — ela é lida apenas pelas edge functions <span className="font-mono">cnpj-enrich</span> e <span className="font-mono">cnpj-enrich-worker</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comportamento */}
      <Card>
        <CardHeader>
          <CardTitle>Enriquecimento automático</CardTitle>
          <CardDescription>
            Quando ativo, ao digitar um CNPJ válido no formulário de nova empresa o sistema consulta o CNPJá
            automaticamente e preenche razão social, endereço, CNAE e sócios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border/50 p-4">
            <div>
              <p className="font-medium">Auto-preencher ao detectar CNPJ válido</p>
              <p className="text-xs text-muted-foreground">
                Preferência por dispositivo — respeita cache local e a fila de reprocessamento.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                toast.success(v ? "Auto-enriquecimento ativado" : "Auto-enriquecimento desativado");
              }}
              aria-label="Alternar enriquecimento automático de CNPJ"
            />
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      <Card>
        <CardHeader>
          <CardTitle>Uso & fila</CardTitle>
          <CardDescription>Resumo em tempo real do cache, rate-limit e fila de reprocessamento.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading || !status ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </>
          ) : (
            <>
              <Metric label="Cache — hits válidos" value={status.cache.success} />
              <Metric label="Cache — CNPJs não encontrados" value={status.cache.not_found} />
              <Metric
                label="Janela atual (rpm)"
                value={`${status.rate?.requestCount ?? 0} / ${status.rate?.limit ?? status.limitPerMinute}`}
              />
              <Metric
                label="Fila pendente"
                value={status.queue.pending + status.queue.processing}
                sub={`falhas: ${status.queue.failed}`}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
