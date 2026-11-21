import { useState } from "react";
import { Sparkles, Rocket, Bug, Gauge, ShieldAlert, AlertTriangle, X, CheckCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangelog, CATEGORY_LABEL, type ChangelogEntry } from "@/hooks/useChangelog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_STYLE: Record<ChangelogEntry["category"], { icon: React.ElementType; className: string }> = {
  feature: { icon: Rocket, className: "bg-primary/10 text-primary border-primary/30" },
  improvement: { icon: Gauge, className: "bg-accent/10 text-accent-foreground border-accent/30" },
  fix: { icon: Bug, className: "bg-success/10 text-success border-success/30" },
  security: { icon: ShieldAlert, className: "bg-warning/10 text-warning border-warning/30" },
  breaking: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Painel de novidades do produto, alimentado por public.changelog_entries. */
export function ChangelogDialog({ open, onClose }: Props) {
  const { entries, unseenCount, isLoading, markAllSeen } = useChangelog();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novidades
            {unseenCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {unseenCount} nova{unseenCount > 1 ? "s" : ""}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Tudo o que mudou na plataforma, em ordem do mais recente.
          </DialogDescription>
        </DialogHeader>

        {unseenCount > 0 && (
          <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={markAllSeen}>
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar tudo como visto
          </Button>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma novidade publicada ainda.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-border/60 pl-5">
            {entries.map((entry) => {
              const style = CATEGORY_STYLE[entry.category];
              const Icon = style.icon;
              return (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
                    <Badge variant="outline" className={cn("text-[10px]", style.className)}>
                      <Icon className="mr-1 h-2.5 w-2.5" />
                      {CATEGORY_LABEL[entry.category]}
                    </Badge>
                    {entry.version && (
                      <span className="font-mono text-[10px] text-muted-foreground">v{entry.version}</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {entry.body}
                  </p>
                  <time className="mt-1 block text-[10px] text-muted-foreground/70">
                    {format(new Date(entry.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botão com badge de não lidas, para o header. */
export function ChangelogButton() {
  const [open, setOpen] = useState(false);
  const { unseenCount } = useChangelog();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label={unseenCount > 0 ? `Novidades (${unseenCount} não vistas)` : "Novidades"}
      >
        <Sparkles className="h-4 w-4" />
        {unseenCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </Button>
      <ChangelogDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}