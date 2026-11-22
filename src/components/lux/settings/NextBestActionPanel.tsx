import { useMemo } from "react";
import { Sparkles, Loader2, RefreshCw, X, Mail, Phone, UserPlus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NBA_ACTION_LABEL,
  NBA_CHANNEL_LABEL,
  useDismissNextBestAction,
  useNextBestActions,
  useRefreshNextBestActions,
  type NextBestActionRow,
} from "@/hooks/useNextBestActions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function priorityClass(priority: number) {
  if (priority >= 70) return "bg-destructive/15 text-destructive border-destructive/30";
  if (priority >= 45) return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function ChannelIcon({ channel }: { channel: NextBestActionRow["channel"] }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" aria-hidden />;
  if (channel === "phone") return <Phone className="h-3.5 w-3.5" aria-hidden />;
  if (channel === "linkedin") return <UserPlus className="h-3.5 w-3.5" aria-hidden />;
  return null;
}

/** Contato clicavel no canal recomendado (mailto/tel/linkedin). */
function ContactLink({ row }: { row: NextBestActionRow }) {
  const label = row.stakeholder_name ?? "Contato";
  if (row.channel === "email" && row.stakeholder_email) {
    return (
      <a className="underline underline-offset-2 hover:text-primary" href={`mailto:${row.stakeholder_email}`}>
        {label}
      </a>
    );
  }
  if (row.channel === "phone" && row.stakeholder_phone) {
    return (
      <a className="underline underline-offset-2 hover:text-primary" href={`tel:${row.stakeholder_phone}`}>
        {label}
      </a>
    );
  }
  if (row.channel === "linkedin" && row.stakeholder_linkedin) {
    return (
      <a
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary"
        href={row.stakeholder_linkedin}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    );
  }
  return <span>{label}</span>;
}

export function NextBestActionPanel() {
  const { data, isLoading, isError, error, refetch } = useNextBestActions(false);
  const refresh = useRefreshNextBestActions();
  const dismiss = useDismissNextBestAction();

  const rows = data ?? [];
  const urgentes = useMemo(() => rows.filter((r) => r.priority >= 70).length, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden />
            Próxima melhor ação
          </h3>
          <p className="text-xs text-muted-foreground">
            Sugestão determinística por deal, com base em tempo sem contato, probabilidade de ganho e canal disponível do contato.
            {urgentes > 0 && ` ${urgentes} em prioridade alta.`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          {refresh.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Recalcular
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando sugestões…
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Falha ao carregar sugestões: {(error as Error).message}
          <Button size="sm" variant="link" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma sugestão ainda. Clique em <strong>Recalcular</strong> para gerar a partir dos deals abertos.
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="hidden lg:table-cell">Por quê</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline" className={priorityClass(row.priority)}>
                      {row.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.deal_title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.stage_name ?? "sem estágio"}
                      {row.deal_value != null && ` · ${brl.format(row.deal_value)}`}
                      {row.win_probability != null && ` · ${row.win_probability}%`}
                    </div>
                  </TableCell>
                  <TableCell>{NBA_ACTION_LABEL[row.action_type]}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <ChannelIcon channel={row.channel} />
                      {NBA_CHANNEL_LABEL[row.channel]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ContactLink row={row} />
                  </TableCell>
                  <TableCell className="hidden max-w-xs text-xs text-muted-foreground lg:table-cell">
                    {row.reason}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Dispensar sugestão de ${row.deal_title ?? "deal"}`}
                      disabled={dismiss.isPending}
                      onClick={() => dismiss.mutate(row.id)}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}