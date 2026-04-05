import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  copied: boolean;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleCopyError = async () => {
    if (!this.state.error) return;
    const text = `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack ?? "N/A"}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const canRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="min-h-[400px] bg-background flex items-center justify-center p-6" role="alert" aria-live="assertive">
          <div className="glass rounded-2xl border border-border/50 p-8 max-w-md w-full text-center space-y-4 animate-fade-in">
            <div className="mx-auto h-14 w-14 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              {canRetry
                ? "Ocorreu um erro inesperado. Tente novamente."
                : "Este erro persistiu após várias tentativas. Recarregue a página."}
            </p>
            {this.state.retryCount > 0 && (
              <p className="text-xs text-muted-foreground/60">
                Tentativa {this.state.retryCount} de {MAX_RETRIES}
              </p>
            )}
            {this.state.error && (
              <details className="text-left">
                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Detalhes técnicos
                </summary>
                <pre className="text-[10px] bg-secondary/30 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground font-mono mt-2">
                  {this.state.error.message}
                </pre>
                <Button
                  onClick={this.handleCopyError}
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 text-[10px] gap-1"
                >
                  {this.state.copied ? (
                    <><CheckCircle2 className="h-3 w-3" /> Copiado</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copiar erro</>
                  )}
                </Button>
              </details>
            )}
            <div className="flex gap-2 justify-center pt-2">
              {canRetry && (
                <Button onClick={this.handleReset} variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              )}
              <Button onClick={() => { window.location.href = "/"; }} size="sm" className="gap-2">
                <Home className="h-3.5 w-3.5" />
                {canRetry ? "Ir ao início" : "Recarregar"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
