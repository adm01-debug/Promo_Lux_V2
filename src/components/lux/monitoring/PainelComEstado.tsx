import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PainelComEstadoProps = {
  /** Consulta em andamento. */
  carregando?: boolean;
  /** Consulta falhou: nunca exibir o estado "sem dados" no lugar do erro. */
  falhou?: boolean;
  mensagemErro?: string;
  aoTentarNovamente?: () => void;
  vazio?: boolean;
  mensagemVazio?: string;
  conteudoVazio?: ReactNode;
  esqueleto?: ReactNode;
  children: ReactNode;
};

/**
 * Envoltório de painel que torna carregamento, falha e vazio estados explícitos.
 * Uso: <PainelComEstado carregando={q.isLoading} falhou={q.isError} ...>{conteudo}</PainelComEstado>
 */
export function PainelComEstado({
  carregando = false,
  falhou = false,
  mensagemErro = "Não foi possível carregar estes dados.",
  aoTentarNovamente,
  vazio = false,
  mensagemVazio = "Nenhum registro encontrado.",
  conteudoVazio,
  esqueleto,
  children,
}: PainelComEstadoProps) {
  if (falhou) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-8 text-center"
      >
        <AlertTriangle
          className="h-5 w-5 text-destructive"
          aria-hidden="true"
        />
        <p className="text-sm text-destructive">{mensagemErro}</p>
        {aoTentarNovamente && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={aoTentarNovamente}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (carregando) {
    return (
      <>
        {esqueleto ?? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
      </>
    );
  }

  if (vazio) {
    return (
      <>
        {conteudoVazio ?? (
          <p className="text-sm text-muted-foreground">{mensagemVazio}</p>
        )}
      </>
    );
  }

  return <>{children}</>;
}
