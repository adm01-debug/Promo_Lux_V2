import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // 404 route access tracked silently — no console output in production
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="glass rounded-2xl border border-border/50 p-8 max-w-md w-full text-center space-y-4">
        <div className="text-6xl font-bold text-primary glow-text">404</div>
        <h1 className="text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          A rota <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> não existe.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-3.5 w-3.5 mr-2" />
            Voltar
          </Button>
          <Link to="/">
            <Button size="sm">
              <Home className="h-3.5 w-3.5 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
