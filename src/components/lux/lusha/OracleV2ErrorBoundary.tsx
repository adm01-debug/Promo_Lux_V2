import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary dedicado ao OracleV2Panel.
 * Impede que uma exceção não capturada (ex.: falha no preflight) derrube
 * a aba inteira do Lusha Intelligence.
 */
export class OracleV2ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log estruturado — quem coletar (Sentry, console) já recebe contexto.
    console.error("[OracleV2ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-semibold">Oracle v2 indisponível no momento</h3>
        </div>
        <p className="text-sm text-destructive/90">
          Algo deu errado ao carregar o painel. Suas outras abas continuam
          funcionando normalmente.
        </p>
        <pre className="max-w-full overflow-auto rounded bg-destructive/5 p-2 text-xs">
          {this.state.error.message}
        </pre>
        <Button size="sm" variant="outline" onClick={this.handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }
}
