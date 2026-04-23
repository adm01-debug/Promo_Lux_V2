import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ShieldAlert, X, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribeOrgErrorBanner,
  clearOrgErrorBanner,
  reloadAfterOrgError,
  type OrgErrorBannerState,
} from "@/lib/orgErrorHandler";

/**
 * Banner global inline para erros de escopo multi-tenant. Aparece em adição
 * ao toast (que pode passar despercebido) e fica visível até o usuário
 * recarregar os dados ou dispensar manualmente. Renderizado uma única vez
 * em App.tsx — escuta o pub/sub centralizado em `orgErrorHandler`.
 */
export function OrgErrorBanner() {
  const [state, setState] = useState<OrgErrorBannerState | null>(null);

  useEffect(() => {
    return subscribeOrgErrorBanner(setState);
  }, []);

  const Icon = state?.kind === "missing" ? AlertTriangle : ShieldAlert;
  const tone =
    state?.kind === "missing"
      ? "border-warning/40 bg-warning/10 text-warning-foreground"
      : "border-destructive/40 bg-destructive/10 text-destructive-foreground";
  const iconTone = state?.kind === "missing" ? "text-warning" : "text-destructive";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3"
      role="region"
      aria-label="Alertas de organização"
    >
      <AnimatePresence>
        {state && (
          <motion.div
            key={state.occurredAt}
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto w-full max-w-2xl rounded-lg border backdrop-blur-md shadow-lg ${tone}`}
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3 p-3">
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconTone}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{state.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{state.description}</p>
                {(state.table || state.op) && (
                  <p className="text-[10px] font-mono text-muted-foreground/80 mt-1">
                    {state.op ? `${state.op} ` : ""}
                    {state.table ? `→ ${state.table}` : ""}
                    {state.expected ? ` · esperado ${state.expected.slice(0, 8)}…` : ""}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {state.kind === "missing" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => {
                        clearOrgErrorBanner();
                        const url = new URL(window.location.href);
                        url.searchParams.set("view", "organizations");
                        window.history.pushState({}, "", url.toString());
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                    >
                      <Building2 className="h-3 w-3" /> Selecionar organização
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={reloadAfterOrgError}
                  >
                    <RefreshCw className="h-3 w-3" /> Recarregar dados
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={clearOrgErrorBanner}
                  >
                    Dispensar
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={clearOrgErrorBanner}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 rounded"
                aria-label="Fechar alerta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}