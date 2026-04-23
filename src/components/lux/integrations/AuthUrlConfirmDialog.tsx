import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AuthUrlConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseAuthUrl: string;
  provider: "gmail" | "outlook";
  scopeType: "user" | "organization";
  redirectUri: string;
}

/** Gera nonce criptograficamente forte (state OAuth). */
function generateNonce(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Tela de confirmação interna: gera um novo `state` (nonce) a cada abertura,
 * injeta na auth URL e mostra ao usuário antes de redirecionar para o provedor.
 */
export function AuthUrlConfirmDialog({
  open,
  onOpenChange,
  baseAuthUrl,
  provider,
  scopeType,
  redirectUri,
}: AuthUrlConfirmDialogProps) {
  const [nonceSeed, setNonceSeed] = useState(0);

  const { fullUrl, state, params } = useMemo(() => {
    void nonceSeed; // re-calcula quando o usuário pede novo nonce
    const newState = generateNonce();
    try {
      const u = new URL(baseAuthUrl);
      u.searchParams.set("state", newState);
      // Snapshot dos parâmetros principais para inspeção.
      const p: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        p[k] = v;
      });
      return { fullUrl: u.toString(), state: newState, params: p };
    } catch {
      return { fullUrl: baseAuthUrl, state: newState, params: {} as Record<string, string> };
    }
  }, [baseAuthUrl, nonceSeed]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: label });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const open_ = () => {
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Confirmar auth URL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Revise o destino, scopes e o <code className="font-mono">state</code> gerado antes de abrir
            o provedor. Cada abertura gera um nonce novo — nada é enviado até você clicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">{provider}</Badge>
            <Badge variant="outline" className="text-[10px]">{scopeType}</Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-warning/40 text-warning">
              <AlertTriangle className="h-2.5 w-2.5" /> dry-run interno
            </Badge>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">State (nonce) gerado agora</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 text-[11px]"
                  onClick={() => setNonceSeed((n) => n + 1)}
                >
                  <RefreshCw className="h-3 w-3" /> Novo nonce
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 text-[11px]"
                  onClick={() => copy(state, "State")}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
            </div>
            <code className="block mt-1 text-[11px] font-mono bg-muted/40 rounded px-2 py-1.5 break-all">
              {state}
            </code>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Redirect URI</p>
            <code className="block mt-1 text-[11px] font-mono bg-muted/40 rounded px-2 py-1.5 break-all">
              {redirectUri}
            </code>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Auth URL completa</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-[11px]"
                onClick={() => copy(fullUrl, "Auth URL")}
              >
                <Copy className="h-3 w-3" /> Copiar URL
              </Button>
            </div>
            <code className="block mt-1 text-[11px] font-mono bg-muted/40 rounded px-2 py-1.5 break-all max-h-32 overflow-y-auto">
              {fullUrl}
            </code>
          </div>

          {Object.keys(params).length > 0 && (
            <details className="rounded-md border border-border/40 bg-background/40 p-2">
              <summary className="text-[11px] cursor-pointer text-muted-foreground">
                Parâmetros decodificados ({Object.keys(params).length})
              </summary>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px]">
                {Object.entries(params).map(([k, v]) => (
                  <div key={k} className="contents">
                    <span className="text-muted-foreground font-mono">{k}</span>
                    <code className="bg-muted/40 rounded px-1 break-all font-mono">{v}</code>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={open_}>
            <ExternalLink className="h-3.5 w-3.5" /> Abrir provedor em nova aba
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}