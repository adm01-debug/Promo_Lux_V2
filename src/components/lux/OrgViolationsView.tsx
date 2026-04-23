import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, AlertTriangle, RefreshCw, Filter, Link2, X as XIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useMyOrganizations, useActiveOrganization } from "@/hooks/useOrganizations";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/lux/EmptyState";
import { ViewSkeleton } from "@/components/lux/ViewSkeleton";
import { OrgViolationAlertsPanel } from "@/components/lux/security/OrgViolationAlertsPanel";

type ViolationKind = "OrgMismatchError" | "MissingOrgContextError";
type PeriodKey = "24h" | "7d" | "30d" | "90d" | "all";

interface ViolationPayload {
  kind?: ViolationKind | string;
  table?: string;
  op?: string;
  expected_org?: string | null;
  received_org?: string | null;
  url?: string | null;
  user_agent?: string | null;
  occurred_at?: string;
  correlation_id?: string | null;
  correlation_seq?: number | null;
}

interface AuditRow {
  id: string;
  created_at: string;
  organization_id: string | null;
  actor_id: string | null;
  new_data: ViolationPayload | null;
}

const PERIOD_OPTIONS: { value: PeriodKey; label: string; ms: number | null }[] = [
  { value: "24h", label: "Últimas 24h", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Últimos 30 dias", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "90d", label: "Últimos 90 dias", ms: 90 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "Todo o período", ms: null },
];

const KIND_LABEL: Record<string, string> = {
  OrgMismatchError: "Organização divergente",
  MissingOrgContextError: "Sem organização ativa",
};

function kindBadgeVariant(kind: string | undefined): "destructive" | "secondary" | "outline" {
  if (kind === "OrgMismatchError") return "destructive";
  if (kind === "MissingOrgContextError") return "secondary";
  return "outline";
}

export function OrgViolationsView() {
  const { isAdmin } = usePermissions();
  const { data: orgs } = useMyOrganizations();
  const { activeOrgId } = useActiveOrganization();

  const [orgFilter, setOrgFilter] = useState<string>("active");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodKey>("7d");
  const [correlationFilter, setCorrelationFilter] = useState<string>("");

  const sinceIso = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.value === periodFilter);
    if (!opt?.ms) return null;
    return new Date(Date.now() - opt.ms).toISOString();
  }, [periodFilter]);

  const effectiveOrgId = orgFilter === "active" ? activeOrgId : orgFilter === "all" ? null : orgFilter;

  const queryKey = ["org-violations", effectiveOrgId, kindFilter, periodFilter];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AuditRow[]>({
    queryKey,
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, created_at, organization_id, actor_id, new_data")
        .eq("table_name", "__org_violation")
        .order("created_at", { ascending: false })
        .limit(500);

      if (effectiveOrgId) q = q.eq("organization_id", effectiveOrgId);
      if (sinceIso) q = q.gte("created_at", sinceIso);

      const { data: rows, error: err } = await q;
      if (err) throw err;
      return (rows ?? []) as unknown as AuditRow[];
    },
  });

  // Filtragem por kind no cliente — `new_data` é jsonb, mais simples filtrar aqui
  // do que via .filter() no PostgREST e mantém o índice por created_at.
  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (kindFilter !== "all") rows = rows.filter((r) => r.new_data?.kind === kindFilter);
    const corr = correlationFilter.trim();
    if (corr) rows = rows.filter((r) => (r.new_data?.correlation_id ?? "").includes(corr));
    return rows;
  }, [data, kindFilter, correlationFilter]);

  // Conta ocorrências por correlation_id no recorte filtrado para
  // destacar bursts (ex.: "5 falhas no mesmo fluxo").
  const correlationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const cid = r.new_data?.correlation_id;
      if (!cid) continue;
      map.set(cid, (map.get(cid) ?? 0) + 1);
    }
    return map;
  }, [filtered]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Apenas administradores do workspace podem visualizar a trilha de violações
            de organização.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Violações de Organização
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Tentativas bloqueadas pelo guard <code className="text-xs">withOrg</code> e
            registradas em <code className="text-xs">audit_logs</code> com{" "}
            <code className="text-xs">table_name="__org_violation"</code>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-filter" className="text-xs">Organização</Label>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger id="org-filter">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Workspace ativo</SelectItem>
                <SelectItem value="all">Todas as minhas organizações</SelectItem>
                {(orgs ?? []).map((m) => (
                  <SelectItem key={m.organization_id} value={m.organization_id}>
                    {m.organizations.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kind-filter" className="text-xs">Tipo (kind)</Label>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger id="kind-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="OrgMismatchError">
                  OrgMismatchError — divergente
                </SelectItem>
                <SelectItem value="MissingOrgContextError">
                  MissingOrgContextError — sem org
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="period-filter" className="text-xs">Período</Label>
            <Select
              value={periodFilter}
              onValueChange={(v) => setPeriodFilter(v as PeriodKey)}
            >
              <SelectTrigger id="period-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="corr-filter" className="text-xs flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Correlation ID
            </Label>
            <div className="relative">
              <Input
                id="corr-filter"
                value={correlationFilter}
                onChange={(e) => setCorrelationFilter(e.target.value)}
                placeholder="corr_xxx_yyy"
                className="font-mono text-xs pr-8"
              />
              {correlationFilter && (
                <button
                  type="button"
                  onClick={() => setCorrelationFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar filtro"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      {!isLoading && !isError && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
          </Badge>
          {effectiveOrgId && orgs && (
            <span>
              Org: {orgs.find((o) => o.organization_id === effectiveOrgId)?.organizations.name ?? "—"}
            </span>
          )}
          {!effectiveOrgId && <span>Todas as organizações acessíveis (RLS-filtered)</span>}
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <ViewSkeleton />
            </div>
          ) : isError ? (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Erro ao carregar</AlertTitle>
              <AlertDescription>
                {(error as Error)?.message ?? "Falha ao buscar audit_logs."}
              </AlertDescription>
            </Alert>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Shield}
                title="Nenhuma violação registrada"
                description="Não há tentativas bloqueadas com os filtros selecionados. Isso é uma boa notícia — o guard de organização está silencioso."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Esperado / Recebido</TableHead>
                    <TableHead className="hidden lg:table-cell">URL</TableHead>
                    <TableHead>Correlation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const p = row.new_data ?? {};
                    const kind = p.kind ?? "—";
                    const cid = p.correlation_id ?? null;
                    const cidCount = cid ? correlationCounts.get(cid) ?? 1 : 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.created_at), "dd/MM/yy HH:mm:ss", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={kindBadgeVariant(kind)} className="text-xs">
                            {KIND_LABEL[kind] ?? kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.table ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs uppercase">
                          {p.op ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.expected_org ? (
                            <div className="space-y-0.5">
                              <div>
                                <span className="text-muted-foreground">esperado:</span>{" "}
                                <code>{p.expected_org.slice(0, 8)}…</code>
                              </div>
                              {p.received_org && (
                                <div>
                                  <span className="text-muted-foreground">recebido:</span>{" "}
                                  <code className="text-destructive">
                                    {p.received_org.slice(0, 8)}…
                                  </code>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[280px] truncate">
                          {p.url ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {cid ? (
                            <button
                              type="button"
                              onClick={() => setCorrelationFilter(cid)}
                              title={`${cid} (clique para filtrar)`}
                              className="inline-flex items-center gap-1.5 group"
                            >
                              <code className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                                {cid.slice(5, 17)}…
                              </code>
                              {cidCount > 1 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  ×{cidCount}
                                </Badge>
                              )}
                              {typeof p.correlation_seq === "number" && (
                                <span className="text-[10px] text-muted-foreground">
                                  #{p.correlation_seq}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default OrgViolationsView;
