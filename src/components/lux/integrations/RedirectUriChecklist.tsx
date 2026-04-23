import { useMemo, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ListChecks,
  ArrowRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildRedirectUriChecklist,
  parseAuthorizedInput,
  type ChecklistItem,
  type UriComparison,
} from "@/lib/redirectUriChecklist";

interface RedirectUriChecklistProps {
  candidate: string;
  provider: "gmail" | "outlook";
}

const STORAGE_KEY = "lux:oauth:authorized-uris";

/**
 * Checklist visual que compara o redirect URI do sandbox com as entradas
 * autorizadas no provedor. Detecta diferenças sutis (trailing slash, porta,
 * query, fragment) que normalmente quebram OAuth em produção.
 */
export function RedirectUriChecklist({ candidate, provider }: RedirectUriChecklistProps) {
  const [authorizedRaw, setAuthorizedRaw] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(`${STORAGE_KEY}:${provider}`) ?? "";
    } catch {
      return "";
    }
  });

  // Carrega o cache do provedor quando alterna gmail/outlook.
  useEffect(() => {
    try {
      setAuthorizedRaw(localStorage.getItem(`${STORAGE_KEY}:${provider}`) ?? "");
    } catch {
      /* noop */
    }
  }, [provider]);

  // Persiste por provedor — facilita reuso entre validações.
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}:${provider}`, authorizedRaw);
    } catch {
      /* noop */
    }
  }, [authorizedRaw, provider]);

  const authorizedList = useMemo(() => parseAuthorizedInput(authorizedRaw), [authorizedRaw]);
  const report = useMemo(
    () => buildRedirectUriChecklist(candidate, authorizedList),
    [candidate, authorizedList],
  );

  const consoleHref =
    provider === "gmail"
      ? "https://console.cloud.google.com/apis/credentials"
      : "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";
  const consoleLabel = provider === "gmail" ? "Google Cloud Console" : "Azure App Registrations";

  const baseErrors = report.baseChecks.filter((c) => c.severity === "error").length;
  const baseWarnings = report.baseChecks.filter((c) => c.severity === "warning").length;

  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
            Checklist do Redirect URI
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Provedores exigem match byte-a-byte. Cole abaixo as entradas autorizadas no {consoleLabel} para comparar.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[11px]">
          <a href={consoleHref} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" /> Abrir {consoleLabel}
          </a>
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">Redirect URIs autorizados no provedor (um por linha)</Label>
        <Textarea
          value={authorizedRaw}
          onChange={(e) => setAuthorizedRaw(e.target.value)}
          placeholder={`https://app.example.com/integrations\nhttp://localhost:5173/integrations`}
          className="text-[11px] font-mono min-h-20"
        />
        <p className="text-[10px] text-muted-foreground">
          {authorizedList.length === 0
            ? "Nenhuma entrada — adicione pelo menos uma para comparar."
            : `${authorizedList.length} entrada${authorizedList.length === 1 ? "" : "s"} para comparação · salvo localmente para ${provider}.`}
        </p>
      </div>

      {/* Resumo */}
      <div className="flex flex-wrap items-center gap-2">
        {report.parseError ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
            <AlertCircle className="h-2.5 w-2.5" /> URI inválido
          </Badge>
        ) : report.hasExactMatch ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-success/40 text-success">
            <CheckCircle2 className="h-2.5 w-2.5" /> Match exato encontrado
          </Badge>
        ) : authorizedList.length > 0 ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
            <AlertCircle className="h-2.5 w-2.5" /> Nenhum match exato
          </Badge>
        ) : null}
        {baseErrors > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
            {baseErrors} erro{baseErrors === 1 ? "" : "s"}
          </Badge>
        )}
        {baseWarnings > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 border-warning/40 text-warning">
            {baseWarnings} aviso{baseWarnings === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {/* Validações estáticas do candidato */}
      <div className="space-y-1">
        {report.baseChecks.map((c) => (
          <ChecklistRow key={c.id} item={c} />
        ))}
      </div>

      {/* Comparações */}
      {report.comparisons.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          <p className="text-[11px] font-medium text-muted-foreground">
            Comparação contra {report.comparisons.length} entrada{report.comparisons.length === 1 ? "" : "s"} autorizada{report.comparisons.length === 1 ? "" : "s"}:
          </p>
          {report.comparisons.map((c, i) => (
            <ComparisonBlock key={i} comparison={c} candidate={report.candidateNormalized} />
          ))}
        </div>
      )}
    </div>
  );
}

function severityIcon(sev: ChecklistItem["severity"]) {
  if (sev === "ok") return <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />;
  if (sev === "warning") return <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />;
  return <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />;
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const tone =
    item.severity === "ok"
      ? "text-muted-foreground"
      : item.severity === "warning"
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="flex items-start gap-2 text-[11px]">
      {severityIcon(item.severity)}
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${tone}`}>{item.label}</p>
        <p className="text-muted-foreground">{item.message}</p>
        {item.expected !== undefined && item.actual !== undefined && item.expected !== item.actual && (
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">Esperado:</span>
            <code className="bg-muted/40 rounded px-1 break-all">{item.expected || "(vazio)"}</code>
            <span className="text-muted-foreground">Atual:</span>
            <code className="bg-muted/40 rounded px-1 break-all">{item.actual || "(vazio)"}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonBlock({
  comparison,
  candidate,
}: {
  comparison: UriComparison;
  candidate: string;
}) {
  const [open, setOpen] = useState(!comparison.exactMatch);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Cole no provedor exatamente como está." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };
  return (
    <div
      className={`rounded-md border p-2 ${
        comparison.exactMatch ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {comparison.exactMatch ? (
              <CheckCircle2 className="h-3 w-3 text-success" />
            ) : (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
            <span className="text-[11px] font-medium">
              {comparison.exactMatch
                ? "Match exato"
                : `${comparison.divergences.length} divergência${comparison.divergences.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <code className="block text-[10px] font-mono text-muted-foreground truncate mt-0.5" title={comparison.authorizedNormalized}>
            {comparison.authorizedNormalized}
          </code>
        </div>
        <span className="text-[10px] text-muted-foreground">{open ? "ocultar" : "ver detalhes"}</span>
      </button>

      {open && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] items-center">
            <span className="text-muted-foreground">Você:</span>
            <code className="bg-muted/40 rounded px-1 py-0.5 break-all font-mono">{candidate}</code>
            <span className="text-muted-foreground flex items-center gap-1">
              <ArrowRight className="h-2.5 w-2.5" /> Autorizado:
            </span>
            <code className="bg-muted/40 rounded px-1 py-0.5 break-all font-mono">{comparison.authorizedNormalized}</code>
          </div>

          {!comparison.exactMatch && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px] w-full"
              onClick={() => copy(candidate)}
            >
              <Copy className="h-3 w-3" /> Copiar URI candidato para colar no provedor
            </Button>
          )}

          <div className="space-y-1">
            {comparison.items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}