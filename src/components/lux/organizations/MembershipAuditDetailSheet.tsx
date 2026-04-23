import { memo, useMemo } from "react";
import { ScrollText, ArrowRight, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import type { MembershipAuditEntry } from "@/hooks/useMembershipAuditLog";

const ROLE_LABEL = { admin: "Admin", sdr: "SDR", viewer: "Viewer" } as const;

const ACTION_BADGE: Record<MembershipAuditEntry["action"], string> = {
  added:        "bg-success/15 text-success border-success/30",
  removed:      "bg-destructive/15 text-destructive border-destructive/30",
  left:         "bg-warning/15 text-warning border-warning/30",
  role_changed: "bg-info/15 text-info border-info/30",
  other:        "bg-muted/30 text-muted-foreground border-border/40",
};

const ACTION_LABEL: Record<MembershipAuditEntry["action"], string> = {
  added: "Adicionado",
  removed: "Removido",
  left: "Saída voluntária",
  role_changed: "Papel alterado",
  other: "Atualização",
};

const labelFor = (
  profile: { full_name: string | null } | null | undefined,
  userId: string | null,
  currentUserId?: string | null,
) => {
  if (userId && currentUserId && userId === currentUserId) return "Você";
  const name = profile?.full_name?.trim();
  if (name) return name;
  if (userId) return `${userId.slice(0, 8)}…`;
  return "Sistema";
};

const copy = async (label: string, value: string | null | undefined) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copiado`, description: value.length > 40 ? `${value.slice(0, 40)}…` : value });
  } catch {
    toast({ title: "Falha ao copiar", variant: "destructive" });
  }
};

function JsonBlock({ data }: { data: Record<string, unknown> | null }) {
  const pretty = useMemo(() => (data ? JSON.stringify(data, null, 2) : ""), [data]);
  if (!data) {
    return <p className="text-[11px] italic text-muted-foreground">— vazio —</p>;
  }
  return (
    <div className="relative group">
      <pre className="text-[11px] font-mono bg-secondary/20 border border-border/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[280px]">
        {pretty}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy("JSON", pretty)}
        aria-label="Copiar JSON"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface Props {
  entry: MembershipAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string | null;
}

export const MembershipAuditDetailSheet = memo(({ entry, open, onOpenChange, currentUserId }: Props) => {
  const actorName = entry ? labelFor(entry.actor_profile, entry.actor_id, currentUserId) : "";
  const targetName = entry ? labelFor(entry.target_profile, entry.target_user_id, currentUserId) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ScrollText className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm">Detalhes do evento</SheetTitle>
              <SheetDescription className="text-[11px]">
                Registro completo do audit_logs com payloads anteriores e novos.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {entry ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Resumo */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${ACTION_BADGE[entry.action]}`}>
                    {ACTION_LABEL[entry.action]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    SQL: {entry.raw_action}
                  </Badge>
                  {entry.is_self_action && (
                    <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                      Ação própria
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={entry.created_at} className="text-foreground/80">
                    {new Date(entry.created_at).toLocaleString("pt-BR")}
                  </time>{" "}
                  · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>

              <Separator />

              {/* Atores */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ator</p>
                  <p className="text-sm font-medium text-foreground">{actorName}</p>
                  {entry.actor_id && (
                    <button
                      type="button"
                      onClick={() => copy("ID do ator", entry.actor_id)}
                      className="mt-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      title="Copiar ID"
                    >
                      {entry.actor_id} <Copy className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Alvo</p>
                  <p className="text-sm font-medium text-foreground">{targetName}</p>
                  {entry.target_user_id && (
                    <button
                      type="button"
                      onClick={() => copy("ID do alvo", entry.target_user_id)}
                      className="mt-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      title="Copiar ID"
                    >
                      {entry.target_user_id} <Copy className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  )}
                </div>

                {(entry.old_role || entry.new_role) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Papel</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-1.5 py-0.5 rounded border border-border/40 bg-muted/30 text-muted-foreground">
                        {entry.old_role ? ROLE_LABEL[entry.old_role] : "—"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                        {entry.new_role ? ROLE_LABEL[entry.new_role] : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Payloads */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">old_data</p>
                  <Badge variant="outline" className="text-[9px]">antes</Badge>
                </div>
                <JsonBlock data={entry.old_data} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">new_data</p>
                  <Badge variant="outline" className="text-[9px]">depois</Badge>
                </div>
                <JsonBlock data={entry.new_data} />
              </div>

              <Separator />

              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ID do registro</p>
                <button
                  type="button"
                  onClick={() => copy("ID do evento", entry.id)}
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors break-all flex items-center gap-1"
                >
                  {entry.id} <Copy className="h-2.5 w-2.5 opacity-60" />
                </button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
});
MembershipAuditDetailSheet.displayName = "MembershipAuditDetailSheet";