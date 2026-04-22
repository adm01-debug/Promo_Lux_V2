import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "lux:active-org";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"idle" | "accepting" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Redirect to login, preserving the invite token
      sessionStorage.setItem("lux:pending-invite", token ?? "");
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate, token]);

  const accept = async () => {
    if (!token) return;
    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_org_invite", { _token: token });
      if (error) throw error;
      if (typeof data === "string") {
        localStorage.setItem(STORAGE_KEY, data);
      }
      setStatus("ok");
      toast({ title: "Convite aceito", description: "Você agora faz parte deste workspace." });
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          {status === "ok" ? (
            <CheckCircle2 className="h-7 w-7 text-success" />
          ) : status === "error" ? (
            <AlertTriangle className="h-7 w-7 text-destructive" />
          ) : (
            <Building2 className="h-7 w-7 text-primary" />
          )}
        </div>

        {status === "ok" ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Bem-vindo!</h1>
            <p className="text-sm text-muted-foreground">Redirecionando para o workspace…</p>
          </>
        ) : status === "error" ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Convite inválido</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button asChild variant="outline">
              <Link to="/">Voltar para o app</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground">Aceitar convite</h1>
            <p className="text-sm text-muted-foreground">
              Você foi convidado para um workspace no LUX IA. Aceite para entrar como membro.
            </p>
            <Button onClick={accept} disabled={status === "accepting"} className="w-full gap-1.5">
              {status === "accepting" && <Loader2 className="h-4 w-4 animate-spin" />}
              Aceitar convite
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
