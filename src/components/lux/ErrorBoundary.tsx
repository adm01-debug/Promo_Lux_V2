import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6" role="alert">
          <div className="glass rounded-2xl border border-border/50 p-8 max-w-md w-full text-center space-y-4 animate-fade-in">
            <div className="mx-auto h-14 w-14 rounded-xl bg-destructive/10 flex items-center justify-center breathe-glow">
              <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <details className="text-left">
                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Detalhes técnicos
                </summary>
                <pre className="text-[10px] bg-secondary/30 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground font-mono mt-2">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={this.handleReset} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
              <Button onClick={() => { window.location.href = "/"; }} size="sm" className="gap-2">
                <Home className="h-3.5 w-3.5" />
                Ir ao início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
