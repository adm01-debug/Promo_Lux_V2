import { useEffect, useMemo, useState } from "react";
import { Database, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { RLS_REGISTRY_TABLES, RLS_REGISTRY_EXEMPT } from "@/lib/rlsRegistry";

type Bucket = "covered" | "exempt" | "missing";

interface TableEntry {
  name: string;
  bucket: Bucket;
}

const BUCKET_STYLES: Record<Bucket, string> = {
  covered: "bg-success/15 text-success border-success/30",
  exempt:  "bg-muted text-muted-foreground border-border",
  missing: "bg-destructive/15 text-destructive border-destructive/40",
};

const BUCKET_LABELS: Record<Bucket, string> = {
  covered: "Coberta",
  exempt:  "Isenta",
  missing: "Faltando",
};

/**
 * Mostra a cobertura do registry RLS frente às tabelas RLS-enabled
 * descobertas pelo Postgres (`pg_catalog_rls_tables`). Destaca tabelas
 * sem entrada nem em `RLS_REGISTRY_TABLES` nem em `RLS_REGISTRY_EXEMPT`.
 */
export const RLSRegistryCoverage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | Bucket>("missing");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("pg_catalog_rls_tables");
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDbTables((data ?? []).map((r) => r.table_name));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const entries = useMemo<TableEntry[]>(() => {
    const known = new Set(RLS_REGISTRY_TABLES);
    const exempt = new Set(RLS_REGISTRY_EXEMPT);
    const inDb = new Set(dbTables);
    const all = new Set<string>([...dbTables, ...RLS_REGISTRY_TABLES, ...RLS_REGISTRY_EXEMPT]);
    return Array.from(all)
      .map<TableEntry>((name) => {
        // Tabelas no registry que sumiram do banco também são tratadas como "missing"
        // para destacar o desalinhamento.
        if (!inDb.has(name)) return { name, bucket: "missing" };
        if (known.has(name)) return { name, bucket: "covered" };
        if (exempt.has(name)) return { name, bucket: "exempt" };
        return { name, bucket: "missing" };
      })
      .sort((a, b) => {
        const order: Record<Bucket, number> = { missing: 0, covered: 1, exempt: 2 };
        return order[a.bucket] - order[b.bucket] || a.name.localeCompare(b.name);
      });
  }, [dbTables]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { covered: 0, exempt: 0, missing: 0 };
    for (const e of entries) c[e.bucket]++;
    return c;
  }, [entries]);

  const visible = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.bucket === filter)),
    [entries, filter],
  );

  return (
    <div className="glass rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Cobertura do Registry RLS</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Compara as tabelas RLS-enabled do banco com o registry compartilhado
              consumido pela edge function <code className="font-mono">rls-tests</code>.
              Tabelas marcadas como <span className="text-destructive">faltando</span> precisam
              ser adicionadas em <code className="font-mono">_shared/rlsTableRegistry.ts</code>.
            </p>
          </div>
        </div>
        <Button onClick={() => void load()} disabled={loading} size="sm" variant="outline" className="gap-2 shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant={counts.missing === 0 ? "default" : "destructive"} className="gap-1.5">
          {counts.missing === 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {counts.missing === 0 ? "Registry sincronizado" : `${counts.missing} faltando`}
        </Badge>
        <span className="text-xs text-muted-foreground font-mono">
          {counts.covered} cobertas · {counts.exempt} isentas · {dbTables.length} no banco
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border/50 bg-background/40 p-0.5">
          {(["missing", "covered", "exempt", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                filter === f
                  ? f === "missing"
                    ? "bg-destructive/20 text-destructive"
                    : f === "covered"
                      ? "bg-success/20 text-success"
                      : "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todas" : BUCKET_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="h-64 rounded-md border border-border/50 bg-background/40">
        {visible.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {loading ? "Carregando…" : "Nenhuma tabela para o filtro selecionado."}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {visible.map((e) => (
              <li key={e.name} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-foreground/90 truncate">{e.name}</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${BUCKET_STYLES[e.bucket]}`}
                >
                  {BUCKET_LABELS[e.bucket]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};