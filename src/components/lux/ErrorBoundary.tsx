import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw, Home, LifeBuoy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 selection:bg-primary/20">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="max-w-md w-full glass p-8 rounded-3xl border border-destructive/20 shadow-2xl relative overflow-hidden"
              role="alert"
            >
              {/* Glow effect */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-destructive/10 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <AlertCircle className="h-8 w-8 text-destructive animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Ops! Algo deu errado.
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Encontramos um erro inesperado. Não se preocupe, seus dados estão seguros, mas precisamos reiniciar o módulo.
                  </p>
                </div>

                {this.state.error && (
                  <div className="w-full p-4 rounded-xl bg-muted/50 border border-border/50 text-left overflow-auto max-h-40">
                    <p className="text-[10px] font-mono text-destructive uppercase tracking-widest mb-1">Stack Trace</p>
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col w-full gap-3 pt-4">
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="w-full h-11 rounded-xl shadow-lg shadow-primary/20 gap-2 font-semibold"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = "/"}
                      className="rounded-xl h-11 gap-2 font-medium"
                    >
                      <Home className="h-4 w-4" />
                      Ir ao início
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => window.open("mailto:suporte@lux-ai.com.br")}
                      className="rounded-xl h-11 gap-2 text-muted-foreground"
                    >
                      <LifeBuoy className="h-4 w-4" />
                      Suporte
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    return this.props.children;
  }
}
