import { Coins, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PainelComEstado } from "@/components/lux/monitoring/PainelComEstado";
import { useLushaCreditUsage } from "@/hooks/useLushaCreditUsage";

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTimeFormat.format(parsed);
}

function formatUser(name: string | null, userId: string | null): string {
  if (name) return name;
  if (!userId) return "Sem usuário";
  return userId.slice(0, 8);
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Painel de consumo de crédito da Lusha (etapa 150): total do mês corrente,
 * gasto por usuário e por operação. Os valores vêm do custo que a própria API
 * devolve em cada chamada, gravado por `lusha-reveal`.
 */
export function LushaCreditUsagePanel() {
  const usage = useLushaCreditUsage();
  const summary = usage.data?.summary;
  const rows = usage.data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
            Consumo de créditos Lusha — mês atual
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => usage.refetch()}
            disabled={usage.isFetching}
          >
            <RefreshCw
              className={usage.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              aria-hidden="true"
            />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Cada revelação consome créditos pagos. O consumo é registrado pela edge function
          <span className="font-mono"> lusha-reveal</span> com o custo informado pela própria API
          Lusha; quando a API não informa o custo, a chamada aparece com zero crédito e conta em
          "revelações".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PainelComEstado
          carregando={usage.isLoading}
          falhou={usage.isError}
          mensagemErro="Não foi possível carregar o consumo de créditos da Lusha."
          aoTentarNovamente={() => usage.refetch()}
          vazio={!summary || summary.calls === 0}
          conteudoVazio={
            <p className="text-sm text-muted-foreground">
              Nenhuma revelação registrada neste mês. O consumo aparece aqui a partir da primeira
              chamada de <span className="font-mono">lusha-reveal</span>, tenha ela sido cobrada ou
              recusada por falta de crédito.
            </p>
          }
        >
          {summary ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Créditos gastos"
                  value={numberFormat.format(summary.credits)}
                  hint="custo informado pela API"
                />
                <Metric
                  label="Revelações"
                  value={numberFormat.format(summary.calls)}
                  hint="chamadas ao Lusha"
                />
                <Metric
                  label="Contatos devolvidos"
                  value={numberFormat.format(summary.records)}
                  hint="registros recebidos"
                />
                <Metric
                  label="Falhas"
                  value={numberFormat.format(summary.failures)}
                  hint={summary.failures > 0 ? "não cobradas ou recusadas" : "nenhuma"}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Última atividade: {formatWhen(summary.lastAt)}
              </p>

              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Por usuário
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-right">Créditos</TableHead>
                        <TableHead className="text-right">Revelações</TableHead>
                        <TableHead className="text-right">Contatos</TableHead>
                        <TableHead className="text-right">Falhas</TableHead>
                        <TableHead>Última</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.byUser.map((user) => (
                        <TableRow key={user.userId ?? "sem-usuario"}>
                          <TableCell className="font-medium">
                            {formatUser(user.name, user.userId)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numberFormat.format(user.credits)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numberFormat.format(user.calls)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numberFormat.format(user.records)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {user.failures > 0 ? (
                              <Badge variant="destructive" className="gap-1">
                                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                                {numberFormat.format(user.failures)}
                              </Badge>
                            ) : (
                              "0"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatWhen(user.lastAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Por operação</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operação</TableHead>
                        <TableHead className="text-right">Créditos</TableHead>
                        <TableHead className="text-right">Chamadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.byOperation.map((operation) => (
                        <TableRow key={operation.operation}>
                          <TableCell className="font-mono text-xs">
                            {operation.operation}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numberFormat.format(operation.credits)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numberFormat.format(operation.calls)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Últimas {Math.min(rows.length, 10)} revelações do mês
                </summary>
                <ul className="mt-3 space-y-1 text-xs">
                  {rows.slice(0, 10).map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-1 last:border-0"
                    >
                      <Badge variant={row.success ? "secondary" : "destructive"}>
                        {row.success ? "ok" : row.error_code ?? "falha"}
                      </Badge>
                      <span className="font-medium">
                        {row.company_name ?? row.domain ?? row.bitrix_card_id ?? "sem empresa"}
                      </span>
                      <span className="text-muted-foreground">
                        {numberFormat.format(row.credits_charged)} crédito(s) ·{" "}
                        {numberFormat.format(row.records_returned)} contato(s)
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {formatUser(null, row.user_id)} · {formatWhen(row.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </PainelComEstado>
      </CardContent>
    </Card>
  );
}