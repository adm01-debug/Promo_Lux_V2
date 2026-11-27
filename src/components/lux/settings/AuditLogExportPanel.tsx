import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Loader2, Database, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuditLogExport, type AuditFilters } from "@/hooks/useAuditLogExport";
import { regrasAtivasPii, resumoMascaramentoPii, usePiiRules } from "@/hooks/usePiiRules";

function toIso(dateStr: string, endOfDay = false): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function AuditLogExportPanel() {
  const { actions, tables, facetsLoading, download, isExporting } = useAuditLogExport();
  const { data: regrasPii } = usePiiRules();
  const regrasAtivas = regrasAtivasPii(regrasPii);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [action, setAction] = useState("");
  const [tableName, setTableName] = useState("");

  const filters: AuditFilters = {
    from: toIso(fromDate),
    to: toIso(toDate, true),
    action: action || null,
    tableName: tableName || null,
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Database className="h-4 w-4" /> Exportar log de auditoria
        </h3>
        <p className="text-sm text-muted-foreground">
          Baixe o histórico de auditoria da organização para SIEM, auditoria externa ou retenção própria (NDJSON, JSON ou CSV).
        </p>
      </div>

      {regrasAtivas.length > 0 && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>O arquivo sai com dados sensíveis mascarados</AlertTitle>
          <AlertDescription>
            {resumoMascaramentoPii(regrasPii)}. Vale para os campos old_data, new_data e metadata
            nos formatos NDJSON e JSON; o CSV traz apenas identificadores (id, data, ação, tabela,
            registro e usuário). Para exportar sem máscara, ajuste em Configurações › Mascaramento
            de PII.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border/40 p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="audit-from" className="text-xs">De</Label>
            <Input id="audit-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to" className="text-xs">Até</Label>
            <Input id="audit-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-action" className="text-xs">Ação</Label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              disabled={facetsLoading}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-table" className="text-xs">Tabela</Label>
            <select
              id="audit-table"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              disabled={facetsLoading}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => download(filters, "ndjson")} disabled={isExporting} className="gap-1.5">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            NDJSON (SIEM)
          </Button>
          <Button variant="outline" onClick={() => download(filters, "json")} disabled={isExporting} className="gap-1.5">
            <FileJson className="h-4 w-4" /> JSON
          </Button>
          <Button variant="outline" onClick={() => download(filters, "csv")} disabled={isExporting} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sem filtro de data o export inclui todo o histórico e pode gerar um arquivo grande. Limite de segurança: 200.000 registros por export.
        </p>
      </div>
    </div>
  );
}