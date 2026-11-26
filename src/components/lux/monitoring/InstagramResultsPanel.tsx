import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, Download, ExternalLink, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCSV } from "@/lib/exportCSV";
import {
  buildInstagramResultsCsv,
  hasInstagramContact,
  matchesInstagramSearch,
  useInstagramQueue,
  useInstagramResults,
  type InstagramTargetType,
} from "@/hooks/useInstagramResults";
import { PainelComEstado } from "./PainelComEstado";

const TARGET_LABELS: Record<InstagramTargetType, string> = {
  profile: "Perfil",
  posts: "Posts",
  hashtag: "Hashtag",
  comments: "Comentários",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  running: "Executando",
  succeeded: "Concluída",
  failed: "Falhou",
  dead: "Sem saída",
};

const numberFmt = new Intl.NumberFormat("pt-BR");

function formatNumber(value: number | null): string {
  return value === null ? "—" : numberFmt.format(value);
}

function formatWhen(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "succeeded") return "default";
  if (status === "dead" || status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{numberFmt.format(value)}</p>
    </div>
  );
}

/**
 * Painel: leads coletados pelo motor de Instagram
 * (`public.instagram_scrape_results`) e historico da fila
 * (`public.instagram_scrape_queue`).
 *
 * Sem esta tela o motor coletava os itens e nenhum usuario conseguia ve-los:
 * nao havia leitor para `instagram_scrape_results` em nenhuma camada.
 */
export function InstagramResultsPanel() {
  const results = useInstagramResults();
  const queue = useInstagramQueue();

  const [term, setTerm] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | InstagramTargetType>("all");
  const [onlyWithContact, setOnlyWithContact] = useState(false);

  const rows = useMemo(() => results.data?.rows ?? [], [results.data]);
  const summary = results.data?.summary;

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (targetFilter === "all" || row.target_type === targetFilter) &&
          (!onlyWithContact || hasInstagramContact(row)) &&
          matchesInstagramSearch(row, term),
      ),
    [rows, targetFilter, onlyWithContact, term],
  );

  const queueRows = queue.data ?? [];
  const exportDisabled = filtered.length === 0;

  const handleExport = () => {
    if (exportDisabled) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(buildInstagramResultsCsv(filtered), `instagram-leads-${stamp}.csv`);
  };

  const handleRefresh = () => {
    void results.refetch();
    void queue.refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
            Leads coletados no Instagram
          </CardTitle>
          <CardDescription>
            Itens que o worker já coletou para esta organização, com o contato encontrado
            no perfil ou post (e-mail, telefone e site quando o perfil é comercial).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PainelComEstado
            carregando={results.isLoading}
            falhou={results.isError}
            mensagemErro="Não foi possível ler os leads coletados no Instagram."
            aoTentarNovamente={() => results.refetch()}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-2 sm:grid-cols-6">
                <SummaryChip label="Itens coletados" value={summary?.total ?? 0} />
                <SummaryChip label="Últimas 24h" value={summary?.last24h ?? 0} />
                <SummaryChip label="Com e-mail" value={summary?.withEmail ?? 0} />
                <SummaryChip label="Com telefone" value={summary?.withPhone ?? 0} />
                <SummaryChip label="Com site" value={summary?.withWebsite ?? 0} />
                <SummaryChip label="Perfis distintos" value={summary?.distinctProfiles ?? 0} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Atualizar
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleExport}
                  disabled={exportDisabled}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ig-leads-search" className="text-xs">
                  Buscar
                </Label>
                <Input
                  id="ig-leads-search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="@usuario, nome, cidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ig-leads-target" className="text-xs">
                  Origem da coleta
                </Label>
                <Select
                  value={targetFilter}
                  onValueChange={(value) => setTargetFilter(value as "all" | InstagramTargetType)}
                >
                  <SelectTrigger id="ig-leads-target" aria-label="Filtrar por origem da coleta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    {(Object.keys(TARGET_LABELS) as InstagramTargetType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {TARGET_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1.5">
                <Switch
                  id="ig-leads-contact"
                  checked={onlyWithContact}
                  onCheckedChange={setOnlyWithContact}
                />
                <Label htmlFor="ig-leads-contact" className="text-xs">
                  Somente com e-mail ou telefone
                </Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {filtered.length === rows.length
                ? `${rows.length} item(ns) carregado(s).`
                : `${filtered.length} de ${rows.length} item(ns) apos o filtro.`}
            </p>

            <PainelComEstado
              carregando={results.isLoading}
              falhou={results.isError}
              vazio={filtered.length === 0}
              mensagemVazio={
                rows.length === 0
                  ? "Nenhum item coletado ainda. Enfileire uma coleta acima; os itens aparecem aqui quando o worker terminar."
                  : "Nenhum item corresponde ao filtro atual."
              }
              conteudoVazio={
                <p className="text-sm text-muted-foreground">
                  {rows.length === 0
                    ? "Nenhum item coletado ainda. Enfileire uma coleta acima; os itens aparecem aqui quando o worker terminar."
                    : "Nenhum item corresponde ao filtro atual."}
                </p>
              }
            >
              <Table>
                <TableCaption className="sr-only">
                  Leads coletados no Instagram para a organização ativa.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Perfil</TableHead>
                    <TableHead scope="col" className="text-right">
                      Seguidores
                    </TableHead>
                    <TableHead scope="col">Contato</TableHead>
                    <TableHead scope="col">Local</TableHead>
                    <TableHead scope="col">Categoria</TableHead>
                    <TableHead scope="col">Origem</TableHead>
                    <TableHead scope="col">Coletado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {row.username ? `@${row.username}` : row.target_value}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.full_name ?? "Sem nome informado"}
                          </span>
                          {row.username && (
                            <a
                              className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                              href={`https://instagram.com/${row.username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir o perfil de ${row.username} no Instagram`}
                            >
                              Abrir perfil
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.followers)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{row.email ?? "—"}</span>
                          <span>{row.phone ?? "—"}</span>
                          {row.website && (
                            <a
                              className="text-primary underline-offset-2 hover:underline"
                              href={row.website}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {row.website}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.business_category ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">
                            {TARGET_LABELS[row.target_type as InstagramTargetType] ??
                              row.target_type}
                          </Badge>
                          <span className="text-muted-foreground">{row.target_value}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{formatWhen(row.fetched_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </PainelComEstado>
          </PainelComEstado>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            Histórico da fila de coleta
          </CardTitle>
          <CardDescription>
            Cada tarefa enfileirada e o resultado do worker: quantas tentativas e, quando
            falhou, o motivo exato. Tarefas sem saída vão para a aba DLQ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PainelComEstado
            carregando={queue.isLoading}
            falhou={queue.isError}
            mensagemErro="Não foi possível ler o histórico da fila de coleta."
            aoTentarNovamente={() => queue.refetch()}
            vazio={queueRows.length === 0}
            mensagemVazio="Nenhuma coleta enfileirada ainda."
          >
            <Table>
              <TableCaption className="sr-only">
                Histórico das tarefas de coleta do Instagram.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Alvo</TableHead>
                  <TableHead scope="col">Origem</TableHead>
                  <TableHead scope="col">Situação</TableHead>
                  <TableHead scope="col" className="text-right">
                    Tentativas
                  </TableHead>
                  <TableHead scope="col">Último erro</TableHead>
                  <TableHead scope="col">Criada em</TableHead>
                  <TableHead scope="col">Atualizada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueRows.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.target_value}</TableCell>
                    <TableCell className="text-xs">
                      {TARGET_LABELS[task.target_type as InstagramTargetType] ?? task.target_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(task.status)}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {task.attempt}/{task.max_attempts}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {task.last_error ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{formatWhen(task.created_at)}</TableCell>
                    <TableCell className="text-xs">{formatWhen(task.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PainelComEstado>
        </CardContent>
      </Card>
    </div>
  );
}