import { Monitor, Smartphone, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { describeUserAgent, useActiveSessions } from "@/hooks/useActiveSessions";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ActiveSessionsPanel() {
  const { sessions, isLoading, revokeSession, revokeOthers, isSaving } = useActiveSessions();
  const others = sessions.filter((s) => !s.is_current);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando sessões...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Sessões ativas
          </h3>
          <p className="text-sm text-muted-foreground">
            Dispositivos com acesso à sua conta. Encerre qualquer sessão que você não reconheça.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => revokeOthers()}
          disabled={isSaving || others.length === 0}
          className="gap-1.5"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sair dos outros dispositivos
        </Button>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma sessão ativa encontrada.</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/Mobile|Android|iPhone|iPad/.test(s.user_agent) ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-foreground flex items-center gap-2">
                    {describeUserAgent(s.user_agent)}
                    {s.is_current && <Badge variant="secondary" className="text-[10px]">Esta sessão</Badge>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.ip ? `${s.ip} · ` : ""}última atividade {formatWhen(s.updated_at)}
                  </p>
                </div>
              </div>
              {!s.is_current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeSession(s.id)}
                  disabled={isSaving}
                  className="text-destructive hover:text-destructive gap-1.5 flex-shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" /> Encerrar
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}