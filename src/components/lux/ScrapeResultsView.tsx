import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DatabaseIcon, RefreshCw, Trash2, CheckCircle2, Building2, Loader2, Search, FileJson, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataError } from "@/components/lux/DataError";
import { EmptyState } from "@/components/lux/EmptyState";
import type { TablesInsert } from "@/integrations/supabase/types";

type RawData = Record<string, unknown>;
interface ScrapeResultRow {
  id: string;
  job_id: string;
  company_id: string | null;
  processed: boolean | null;
  raw_data: RawData;
  created_at: string;
}
interface JobLite { id: string; name: string }

const pickString = (raw: RawData, keys: string[]): string => {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const computeIPC = (raw: RawData): number => {
  let s = 50;
  if (pickString(raw, ["email"])) s += 15;
  if (pickString(raw, ["phone"])) s += 10;
  if (pickString(raw, ["website", "web_site"])) s += 10;
  const rating = pickString(raw, ["rating"]);
  if (rating && parseFloat(rating) >= 4) s += 15;
  return Math.min(s, 100);
};

export const ScrapeResultsView = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "processed" | "unprocessed">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: jobs } = useQuery({
    queryKey: ["scrape-jobs-lite"],
    queryFn: async (): Promise<JobLite[]> => {
      const { data, error } = await db
        .from("scrape_jobs")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: results, isLoading, error, refetch } = useQuery({
    queryKey: ["scrape-results", jobFilter, statusFilter],
    queryFn: async (): Promise<ScrapeResultRow[]> => {
      let q = db
        .from("scrape_results")
        .select("id, job_id, company_id, processed, raw_data, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (jobFilter !== "all") q = q.eq("job_id", jobFilter);
      if (statusFilter === "processed") q = q.eq("processed", true);
      if (statusFilter === "unprocessed") q = q.or("processed.is.null,processed.eq.false");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ScrapeResultRow[];
    },
  });

  // Realtime sync
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`private:${user.id}:scrape-results`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scrape_results", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["scrape-results"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const filtered = useMemo(() => {
    if (!results) return [];
    const term = search.trim().toLowerCase();
    if (!term) return results;
    return results.filter(r => {
      const name = pickString(r.raw_data, ["name", "title"]);
      const addr = pickString(r.raw_data, ["address", "city"]);
      return name.toLowerCase().includes(term) || addr.toLowerCase().includes(term);
    });
  }, [results, search]);

  const stats = useMemo(() => {
    const total = results?.length ?? 0;
    const processed = results?.filter(r => r.processed).length ?? 0;
    return { total, processed, pending: total - processed };
  }, [results]);

  const jobNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (jobs ?? []).forEach(j => { map[j.id] = j.name; });
    return map;
  }, [jobs]);

  const reprocessMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("scrape_results")
        .update({ processed: false, company_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-results"] });
      toast({ title: "Marcado para reprocessar", description: "O resultado voltou para a fila." });
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("scrape_results").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-results"] });
      toast({ title: "Resultado removido" });
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async (row: ScrapeResultRow) => {
      const raw = row.raw_data;
      const name = pickString(raw, ["name", "title"]) || "Sem nome";
      const sector = pickString(raw, ["category", "type"]) || "Não classificado";
      const location = pickString(raw, ["address", "city"]);
      const website = pickString(raw, ["website", "web_site"]);
      const phone = pickString(raw, ["phone"]);
      const email = pickString(raw, ["email"]);
      const ipc = computeIPC(raw);

      const insertPayload: TablesInsert<"companies"> = {
        name, sector, location, website, phone, email,
        source: "gmaps",
        ipc_score: ipc,
        enriched: !!(email || phone),
        raw_data: raw as TablesInsert<"companies">["raw_data"],
      };
      const { data: company, error: cErr } = await db
        .from("companies")
        .insert(insertPayload)
        .select("id")
        .single();
      if (cErr) throw cErr;

      const { error: uErr } = await db
        .from("scrape_results")
        .update({ processed: true, company_id: company.id })
        .eq("id", row.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-results"] });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Convertido em empresa", description: "Empresa criada e qualificada pelo IPC." });
    },
    onError: (err) => toast({ title: "Erro ao converter", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DatabaseIcon className="h-6 w-6 text-primary" />
            Resultados de Raspagem
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inspecione, reprocesse ou converta resultados brutos em empresas — {stats.total} registros
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Processados", value: stats.processed, color: "text-success" },
          { label: "Pendentes", value: stats.pending, color: "text-warning" },
        ].map(s => (
          <div key={s.label} className="glass rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
            <p className={`text-xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou endereço…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="h-9 text-xs w-[200px]"><SelectValue placeholder="Job" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os jobs</SelectItem>
            {(jobs ?? []).map(j => (
              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="processed">Processados</SelectItem>
            <SelectItem value="unprocessed">Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" /> Registros brutos
          </h3>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {error ? (
          <div className="p-4"><DataError message={(error as Error).message} onRetry={() => refetch()} /></div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Carregando resultados…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-border/20">
            {filtered.map((row, i) => {
              const name = pickString(row.raw_data, ["name", "title"]) || "Sem nome";
              const addr = pickString(row.raw_data, ["address", "city"]);
              const isOpen = expanded === row.id;
              const isProcessed = !!row.processed;
              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <div
                    className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileJson className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(row.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            {jobNameById[row.job_id] && (
                              <Badge variant="outline" className="text-[10px] bg-secondary/50">
                                {jobNameById[row.job_id]}
                              </Badge>
                            )}
                            {addr && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[280px]">{addr}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isProcessed ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-success/20 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3" /> Processado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-warning/20 text-warning border-warning/30">
                            Pendente
                          </Badge>
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-3 border-t border-border/20 space-y-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                                Raw data
                              </p>
                              <ScrollArea className="h-[260px] rounded-md border border-border/40 bg-background/40">
                                <pre className="p-3 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all">
                                  {JSON.stringify(row.raw_data, null, 2)}
                                </pre>
                              </ScrollArea>
                            </div>
                            {row.company_id && (
                              <p className="text-[11px] text-muted-foreground">
                                Vinculado à empresa: <span className="font-mono text-foreground">{row.company_id}</span>
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                              {!isProcessed && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  disabled={convertMutation.isPending}
                                  onClick={() => convertMutation.mutate(row)}
                                >
                                  {convertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                                  Converter em empresa
                                </Button>
                              )}
                              {isProcessed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  disabled={reprocessMutation.isPending}
                                  onClick={() => reprocessMutation.mutate(row.id)}
                                >
                                  {reprocessMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                  Reprocessar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 text-xs text-destructive hover:text-destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(row.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={DatabaseIcon}
            title="Nenhum resultado encontrado"
            description="Execute uma raspagem no Google Maps para popular os resultados brutos."
          />
        )}
      </div>
    </div>
  );
};
