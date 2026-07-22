import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

import { StatusBadge } from "./StatusBadge";
import type { LushaSession } from "./types";

const PAGE_SIZE = 5;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Processando" },
  { value: "success", label: "Sucesso" },
  { value: "failed", label: "Falha" },
];

interface SessionsPanelProps {
  sessions: LushaSession[];
}

/**
 * R32 — Painel de sessões extraído de LushaIntelligenceView.
 * Componente puro/controlado: recebe a lista completa e encapsula
 * filtros (texto + status) e paginação client-side.
 * Preserva o visual da tabela original (5 colunas + StatusBadge).
 */
export function SessionsPanel({ sessions }: SessionsPanelProps) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const deferredQ = useDeferredValue(q);

  // Reset de página quando filtros mudam.
  useEffect(() => {
    setPage(1);
  }, [deferredQ, status]);

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return sessions.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (needle && !s.company_name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [sessions, deferredQ, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const showPager = filtered.length > PAGE_SIZE;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Últimas sessões de busca</CardTitle>
        <CardDescription>Histórico das 10 buscas mais recentes.</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma sessão registrada.
          </div>
        ) : (
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
                <SelectTrigger
                  aria-label="Filtrar por status"
                  className="h-9 sm:w-56"
                >
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

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma sessão corresponde aos filtros.
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
                      {paged.map((s) => (
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

                {showPager && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      Página {safePage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage(safePage + 1)}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
