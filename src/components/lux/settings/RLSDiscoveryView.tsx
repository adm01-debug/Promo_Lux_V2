import { useEffect, useMemo, useState } from "react";
import {
  Search, Database, RefreshCw, Loader2, AlertTriangle, CheckCircle2,
  Download, ClipboardCopy, FileCode2, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { downloadCSV } from "@/lib/exportCSV";
import { RLS_REGISTRY_TABLES, RLS_REGISTRY_EXEMPT } from "@/lib/rlsRegistry";

type Bucket = "covered" | "exempt" | "missing";

interface DiscoveredTable {
  name: string;
  bucket: Bucket;
  inDb: boolean;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  has_default: boolean;
  column_default: string | null;
}

/** Colunas que o runner já injeta automaticamente — não precisam estar no payload. */
const AUTO_COLUMNS = new Set(["id", "created_at", "updated_at", "organization_id", "user_id"]);

/** Sugere um valor literal JS para uma coluna NOT NULL sem default. */
function sampleValueFor(col: ColumnInfo): string {
  const u = col.udt_name.toLowerCase();
  const d = col.data_type.toLowerCase();
  if (u === "uuid") return `ctx.${col.column_name.replace(/_id$/, "") || "ref"} /* TODO: id de tabela referenciada */`;
  if (u.startsWith("int") || d.includes("integer") || d.includes("numeric") || d.includes("double") || d.includes("real")) return "0";
  if (u === "bool") return "false";
  if (u === "jsonb" || u === "json") return "{}";
  if (d.includes("array") || u.startsWith("_")) return "[]";
  if (u === "timestamptz" || u === "timestamp" || d.includes("timestamp")) return "new Date().toISOString()";
  if (u === "date") return `"${new Date().toISOString().slice(0, 10)}"`;
  // text / varchar / enum / etc.
  return `"${col.column_name}-sample"`;
}

/** Constrói o objeto payload a partir das colunas obrigatórias da tabela. */
function buildPayloadFromColumns(table: string, cols: ColumnInfo[]): string {
  const required = cols.filter((c) => !c.is_nullable && !c.has_default && !AUTO_COLUMNS.has(c.column_name));
  const lines: string[] = [];
  // Sempre inclui organization_id + user_id (vêm do runner mesmo com default).
  lines.push(`      organization_id: org,`);
  lines.push(`      user_id: uid,`);
  for (const c of required) {
    lines.push(`      ${c.column_name}: ${sampleValueFor(c)},`);
  }
  const requires = required
    .filter((c) => c.udt_name === "uuid" && c.column_name.endsWith("_id"))
    .map((c) => c.column_name.replace(/_id$/, ""))
    .filter(Boolean);
  const requiresLine = requires.length
    ? `\n    requires: ${JSON.stringify(requires)},`
    : "";
  return `  {
    table: ${JSON.stringify(table)},${requiresLine}
    payload: (org, uid${requires.length ? ", ctx" : ""}) => ({
${lines.join("\n")}
    }),
  },`;
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

/** Sugere um payload "esqueleto" para uma nova entrada de registry. */
function buildRegistrySnippet(tables: string[]): string {
  if (tables.length === 0) {
    return "// Nenhuma tabela faltando — registry sincronizado ✨";
  }
  const entries = tables
    .map(
      (t) =>
        `  { table: ${JSON.stringify(t)}, payload: (org, uid) => ({ /* TODO: campos NOT NULL de ${t} */ organization_id: org, user_id: uid }) },`,
    )
    .join("\n");
  return `// Adicione em supabase/functions/_shared/rlsTableRegistry.ts → RLS_TABLES\n${entries}\n`;
}

/**
 * Tela administrativa de "RLS Discovery".
 * Lista todas as tabelas RLS-enabled descobertas via `pg_catalog_rls_tables`,
 * cruza com o registry frontend (`RLS_REGISTRY_TABLES` / `RLS_REGISTRY_EXEMPT`)
 * e permite exportar em CSV ou copiar um snippet TypeScript pronto para colar
 * no whitelist do edge function `rls-tests`.
 */
export const RLSDiscoveryView = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | Bucket>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("pg_catalog_rls_tables");
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDbTables((data ?? []).map((r) => r.table_name).sort());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const entries = useMemo<DiscoveredTable[]>(() => {
    const known = new Set(RLS_REGISTRY_TABLES);
    const exempt = new Set(RLS_REGISTRY_EXEMPT);
    const inDb = new Set(dbTables);
    const all = new Set<string>([...dbTables, ...RLS_REGISTRY_TABLES, ...RLS_REGISTRY_EXEMPT]);
    return Array.from(all)
      .map<DiscoveredTable>((name) => {
        if (!inDb.has(name)) return { name, bucket: "missing", inDb: false };
        if (known.has(name)) return { name, bucket: "covered", inDb: true };
        if (exempt.has(name)) return { name, bucket: "exempt", inDb: true };
        return { name, bucket: "missing", inDb: true };
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && e.bucket !== filter) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, search]);

  const missingTables = useMemo(
    () => entries.filter((e) => e.bucket === "missing").map((e) => e.name),
    [entries],
  );

  const exportFullCSV = () => {
    downloadCSV(
      entries.map((e) => ({
        table: e.name,
        status: BUCKET_LABELS[e.bucket],
        in_database: e.inDb ? "yes" : "no",
        in_registry: RLS_REGISTRY_TABLES.includes(e.name) ? "yes" : "no",
        in_exempt: RLS_REGISTRY_EXEMPT.includes(e.name) ? "yes" : "no",
      })),
      `rls-discovery-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast({ title: "CSV exportado", description: `${entries.length} tabelas` });
  };

  const exportMissingCSV = () => {
    if (missingTables.length === 0) {
      toast({ title: "Nada a exportar", description: "Registry está sincronizado." });
      return;
    }
    downloadCSV(
      missingTables.map((t) => ({ table: t })),
      `rls-missing-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast({ title: "Faltantes exportadas", description: `${missingTables.length} tabelas` });
  };

  const copySnippet = async () => {
    const snippet = buildRegistrySnippet(missingTables);
    try {
      await navigator.clipboard.writeText(snippet);
      toast({
        title: "Snippet copiado",
        description: missingTables.length
          ? `${missingTables.length} entradas para colar em RLS_TABLES`
          : "Registry já está sincronizado",
      });
    } catch {
      toast({ variant: "destructive", title: "Falha ao copiar", description: "Sua permissão de clipboard pode estar bloqueada." });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
          RLS Discovery
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Descobre tabelas com Row-Level Security ativada no banco e cruza com o
          registry usado pela edge function <code className="font-mono">rls-tests</code>.
        </p>
      </div>

      <div className="glass rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Tabelas RLS-enabled</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Lista obtida via <code className="font-mono">pg_catalog_rls_tables()</code>.
                Tabelas <span className="text-destructive">faltando</span> ainda não
                foram adicionadas ao whitelist e ficam fora dos testes automáticos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void load()} disabled={loading} size="sm" variant="outline" className="gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </div>
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
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tabela…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/50 bg-background/40 p-0.5">
            {(["all", "missing", "covered", "exempt"] as const).map((f) => (
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
          <div className="ml-auto flex items-center gap-1.5">
            <Button onClick={exportFullCSV} size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
              <Download className="h-3.5 w-3.5" />
              CSV completo
            </Button>
            <Button
              onClick={exportMissingCSV}
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs"
              disabled={missingTables.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              CSV faltantes
            </Button>
            <Button
              onClick={copySnippet}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              disabled={missingTables.length === 0}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copiar snippet
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[420px] rounded-md border border-border/50 bg-background/40">
          {visible.length === 0 ? (
            <div className="px-3 py-12 text-center text-xs text-muted-foreground">
              {loading ? "Carregando…" : "Nenhuma tabela para os filtros selecionados."}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {visible.map((e) => (
                <li key={e.name} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-foreground/90 truncate">{e.name}</span>
                    {!e.inDb && (
                      <span className="text-[10px] text-muted-foreground italic">
                        (no registry, ausente no banco)
                      </span>
                    )}
                  </div>
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

        {missingTables.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileCode2 className="h-3.5 w-3.5" />
              <span>Snippet sugerido para <code className="font-mono">RLS_TABLES</code></span>
            </div>
            <pre className="text-[11px] font-mono bg-background/60 border border-border/40 rounded-md p-3 overflow-x-auto whitespace-pre">
{buildRegistrySnippet(missingTables)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default RLSDiscoveryView;