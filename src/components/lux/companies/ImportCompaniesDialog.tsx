import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Loader2, FileText, CheckCircle2, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { supabase } from "@/integrations/supabase/client";
import { companySchema } from "@/lib/schemas/company";

/** Colunas aceitas no CSV (case-insensitive). Aliases → campo canônico. */
const COLUMN_ALIASES: Record<string, string> = {
  nome: "name", name: "name", empresa: "name", razao_social: "name",
  cnpj: "cnpj",
  setor: "sector", sector: "sector", segmento: "sector",
  localizacao: "location", location: "location", cidade: "location", local: "location",
  email: "email", "e-mail": "email",
  telefone: "phone", phone: "phone", fone: "phone",
  website: "website", site: "website", url: "website",
  linkedin: "linkedin_url", linkedin_url: "linkedin_url",
  instagram: "instagram_url", instagram_url: "instagram_url",
  funcionarios: "employees", employees: "employees",
  faturamento: "revenue", revenue: "revenue",
  descricao: "description", description: "description",
};

/** Parser CSV simples com suporte a aspas e vírgulas dentro de campos. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  return rows;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export const ImportCompaniesDialog = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: history } = useQuery({
    queryKey: ["bulk_imports-history"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_imports")
        .select("id,file_name,total_rows,inserted_count,skipped_count,invalid_count,created_at")
        .eq("entity", "companies")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; file_name: string | null; total_rows: number;
        inserted_count: number; skipped_count: number; invalid_count: number; created_at: string;
      }>;
    },
  });

  const handleFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const orgId = getActiveOrgId();
      if (!orgId) throw new Error("Nenhuma organização ativa.");

      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");

      // Mapeia cabeçalho → campos canônicos
      const header = rows[0].map((h) => COLUMN_ALIASES[h.trim().toLowerCase()] ?? null);
      if (!header.includes("name")) {
        throw new Error("CSV precisa de uma coluna de nome (ex: 'nome' ou 'name').");
      }

      // Empresas existentes para dedup (por CNPJ e por nome)
      const { data: existing } = await db.from("companies").select("name, cnpj");
      const existingCnpj = new Set((existing ?? []).map((c: { cnpj: string | null }) => c.cnpj?.replace(/\D/g, "")).filter(Boolean));
      const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name.trim().toLowerCase()));

      const toInsert: Record<string, unknown>[] = [];
      const seenInBatch = new Set<string>();
      const res: ImportResult = { inserted: 0, skipped: 0, invalid: 0, errors: [] };

      for (let r = 1; r < rows.length; r++) {
        const record: Record<string, string> = {};
        header.forEach((field, idx) => {
          if (field) record[field] = (rows[r][idx] ?? "").trim();
        });

        const parsed = companySchema.safeParse(record);
        if (!parsed.success) {
          res.invalid++;
          if (res.errors.length < 5) {
            res.errors.push(`Linha ${r + 1}: ${parsed.error.issues[0]?.message ?? "inválida"}`);
          }
          continue;
        }

        const cnpjKey = record.cnpj?.replace(/\D/g, "") || "";
        const nameKey = record.name.trim().toLowerCase();
        const dedupKey = cnpjKey || nameKey;
        if (
          (cnpjKey && existingCnpj.has(cnpjKey)) ||
          existingNames.has(nameKey) ||
          seenInBatch.has(dedupKey)
        ) {
          res.skipped++;
          continue;
        }
        seenInBatch.add(dedupKey);

        const clean = Object.fromEntries(
          Object.entries(parsed.data).filter(([, v]) => v !== "" && v !== undefined),
        );
        toInsert.push({ ...clean, source: "import" });
      }

      if (toInsert.length) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        const withUser = toInsert.map((c) => ({ ...c, user_id: userId }));
        // Insere em lotes de 500
        for (let i = 0; i < withUser.length; i += 500) {
          const batch = withUser.slice(i, i + 500);
          const { error } = await db.from("companies").insert(batch as never);
          if (error) throw error;
          res.inserted += batch.length;
        }
      }

      // Trilha da importação: registra o que entrou, o que foi ignorado e os
      // motivos, para permitir auditar uma carga errada depois. Best-effort:
      // se o log falhar, os dados já foram gravados e não desfazemos a carga.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const { error: logErr } = await supabase.from("bulk_imports").insert({
          user_id: userData.user?.id,
          organization_id: orgId,
          entity: "companies",
          file_name: file.name,
          total_rows: rows.length - 1,
          inserted_count: res.inserted,
          skipped_count: res.skipped,
          invalid_count: res.invalid,
          errors: res.errors,
        } as never);
        if (logErr) console.warn("bulk_imports log falhou:", logErr.message);
      } catch (logEx) {
        console.warn("bulk_imports log falhou:", logEx);
      }

      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["bulk_imports-history"] });
      toast({
        title: "Importação concluída",
        description: `${res.inserted} adicionada(s), ${res.skipped} duplicada(s) ignorada(s), ${res.invalid} inválida(s).`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro na importação", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 text-sm">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar empresas via CSV</DialogTitle>
          <DialogDescription>
            O arquivo deve ter uma linha de cabeçalho. Colunas reconhecidas: nome, cnpj, setor,
            localização, email, telefone, website, linkedin, instagram, funcionários, faturamento, descrição.
            Duplicadas (por CNPJ ou nome) são ignoradas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {result ? (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {result.inserted} empresa(s) importada(s)
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {result.skipped} duplicada(s) ignorada(s)
            </div>
            {result.invalid > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" /> {result.invalid} linha(s) inválida(s)
                </div>
                <ul className="text-xs text-muted-foreground pl-6 list-disc">
                  {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecione um arquivo .csv para importar.</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importando..." : result ? "Importar outro arquivo" : "Escolher arquivo"}
          </Button>
        </DialogFooter>

        {!!(history ?? []).length && (
          <div className="border-t border-border/50 pt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Importações recentes
            </div>
            {(history ?? []).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{h.file_name ?? "arquivo.csv"}</span>
                <span className="shrink-0 tabular-nums">
                  {h.inserted_count} ok · {h.skipped_count} dup · {h.invalid_count} inv
                  <span className="ml-2 text-muted-foreground/60">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
