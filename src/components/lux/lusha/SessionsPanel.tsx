import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";

import { StatusBadge } from "./StatusBadge";
import type { LushaSession } from "./types";

const PAGE_SIZE = 10;
const Q_KEY = "lsq";
const S_KEY = "lss";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Processando" },
  { value: "success", label: "Sucesso" },
  { value: "failed", label: "Falha" },
];

// Escapa `,`, `.`, `%` para o operador `ilike` do PostgREST.
function escapeIlike(v: string): string {
  return v.replace(/([%,.])/g, "\\$1");
}

export interface RetryOutcome {
  status: "success" | "failed";
  error_message: string | null;
  total_found?: number;
}

interface SessionsPanelProps {
  /** Injeção opcional para testes; em produção o painel usa o cliente real. */
  fetcher?: (args: {
    q: string;
    status: string;
    limit: number;
  }) => Promise<{ rows: LushaSession[]; total: number }>;
  /** Injeção opcional para testes; substitui a chamada real de retentativa. */
  retryHandler?: (session: LushaSession) => Promise<RetryOutcome>;
}

/** Executa uma retentativa real via edge `lusha-search` e persiste o desfecho. */
async function defaultRetryHandler(session: LushaSession): Promise<RetryOutcome> {
  const departments = session.departments_requested ?? [];
  const stamp = new Date().toISOString();

  const invocation = await supabase.functions.invoke<{
    session_id?: string;
    total_found?: number;
  }>("lusha-search", {
    body: {
      company_name: session.company_name,
      departments,
      session_size: 20,
    },
  });

  if (invocation.error) {
    const msg = invocation.error.message ?? "Falha desconhecida na retentativa.";
    const errorMessage = `Retentado em ${stamp} — ${msg}`;
    await supabase
      .from("lusha_search_sessions")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", session.id);
    throw new Error(msg);
  }

  const total = invocation.data?.total_found ?? 0;
  const newId = invocation.data?.session_id ?? null;
  const message = newId
    ? `Retentado em ${stamp} — sucesso (nova sessão ${newId}).`
    : `Retentado em ${stamp} — sucesso.`;

  await supabase
    .from("lusha_search_sessions")
    .update({ status: "success", error_message: message, total_found: total })
    .eq("id", session.id);

  return { status: "success", error_message: message, total_found: total };
}


async function defaultFetcher({
  q,
  status,
  limit,
}: {
  q: string;
  status: string;
  limit: number;
}): Promise<{ rows: LushaSession[]; total: number }> {
  let query = supabase
    .from("lusha_search_sessions")
    .select(
      "id, company_name, departments_requested, departments_mapped, total_found, status, error_message, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, limit - 1));

  if (status !== "all") query = query.eq("status", status);
  const needle = q.trim();
  if (needle) query = query.ilike("company_name", `%${escapeIlike(needle)}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as LushaSession[], total: count ?? 0 };
}

/**
 * R36 — Painel de sessões com paginação server-side, carregamento incremental
 * (load-more) e filtros preservados no URL (`?lsq=&lss=`).
 * Mantém compatibilidade visual com o split original (R32).
 */
export function SessionsPanel({ fetcher = defaultFetcher }: SessionsPanelProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQ = searchParams.get(Q_KEY) ?? "";
  const urlStatus = searchParams.get(S_KEY) ?? "all";

  // Buffer local para digitação fluida; sincroniza no URL de forma debounced.
  const [q, setQ] = useState(urlQ);
  const [status, setStatus] = useState(urlStatus);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const deferredQ = useDeferredValue(q);

  // Sincroniza filtros → URL (debounced 300ms para o texto).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (deferredQ) next.set(Q_KEY, deferredQ);
          else next.delete(Q_KEY);
          if (status && status !== "all") next.set(S_KEY, status);
          else next.delete(S_KEY);
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [deferredQ, status, setSearchParams]);

  // Sincroniza URL → estado quando o usuário navega (back/forward).
  useEffect(() => {
    setQ(urlQ);
    setStatus(urlStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ, urlStatus]);

  // Reset do carregamento incremental quando os filtros mudam.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [deferredQ, status]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["lusha-sessions", "list", deferredQ, status, limit],
    queryFn: () => fetcher({ q: deferredQ, status, limit }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const canLoadMore = rows.length < total;

  const loadMore = useCallback(() => {
    setLimit((n) => n + PAGE_SIZE);
  }, []);

  const hasActiveFilters = useMemo(
    () => !!deferredQ.trim() || status !== "all",
    [deferredQ, status],
  );

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Últimas sessões de busca</CardTitle>
        <CardDescription>
          Paginação server-side · filtros preservados no URL
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              aria-label="Buscar sessão por empresa"
              placeholder="Buscar por empresa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 sm:max-w-xs"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filtrar por status" className="h-9 sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <div
              role="alert"
              className="text-center py-12 text-destructive text-sm"
            >
              Falha ao carregar sessões.
            </div>
          ) : isLoading ? (
            <div
              role="status"
              aria-label="Carregando sessões"
              className="flex items-center justify-center py-12 text-muted-foreground text-sm"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {hasActiveFilters
                ? "Nenhuma sessão corresponde aos filtros."
                : "Nenhuma sessão registrada."}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Departamentos</TableHead>
                      <TableHead className="text-center">Encontrados</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.company_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(s.departments_requested ?? []).slice(0, 3).map((d) => (
                              <Badge
                                key={d}
                                variant="outline"
                                className="border-border/50 text-xs"
                              >
                                {d}
                              </Badge>
                            ))}
                            {(s.departments_requested?.length ?? 0) > 3 && (
                              <Badge
                                variant="outline"
                                className="border-border/50 text-xs"
                              >
                                +{(s.departments_requested?.length ?? 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {s.total_found ?? 0}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Mostrando {rows.length} de {total}
                </span>
                {canLoadMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={isFetching}
                    aria-label="Carregar mais sessões"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Carregando…
                      </>
                    ) : (
                      "Carregar mais"
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
