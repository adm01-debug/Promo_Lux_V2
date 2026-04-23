import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  Search,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useDryRunLogs, type DryRunLogEntry } from "@/hooks/useDryRunLogs";

/**
 * Painel de auditoria local dos dry-runs do Sandbox OAuth. Permite filtrar
 * por provider, outcome e busca textual; exporta JSON e limpa o histórico.
 */
export function DryRunLogsPanel() {
  const { logs, clear, exportJson } = useDryRunLogs();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (provider !== "all" && l.provider !== provider) return false;
      if (outcome !== "all" && l.outcome !== outcome) return false;
      if (!q) return true;
      return (
        l.redirect_uri.toLowerCase().includes(q) ||
        l.scopes.join(" ").toLowerCase().includes(q) ||
        l.warnings.join(" ").toLowerCase().includes(q) ||
        (l.error ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, provider, outcome, query]);

  const counts = useMemo(() => {
    return {
      total: logs.length,
      ok: logs.filter((l) => l.outcome === "ok").length,
      warning: logs.filter((l) => l.outcome === "warning").length,
      error: logs.filter((l) => l.outcome === "error").length,
    };
  }, [logs]);

  const download = () => {
    try {
      const blob = new Blob([exportJson()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oauth-dry-run-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportado", description: `${logs.length} registro(s) em JSON.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao exportar.", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <History className="h-3.5 w-3.5" />
          Logs do dry-run
          {counts.total > 0 && (
            <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
              {counts.total}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Auditoria de dry-runs
          </SheetTitle>
          <SheetDescription className="text-xs">
            Histórico local das validações do Sandbox OAuth (até 200 entradas).
            Use para identificar quando uma configuração começou a falhar — sem
            consultar o backend.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip label="Total" value={counts.total} tone="muted" />
            <StatChip label="OK" value={counts.ok} tone="success" />
            <StatChip label="Avisos" value={counts.warning} tone="warning" />
            <StatChip label="Erros" value={counts.error} tone="destructive" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar URI, scope, warning…"
                className="h-9 pl-7 text-xs"
              />
            </div>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-9 w-full sm:w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos provedores</SelectItem>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="h-9 w-full sm:w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="ok">Apenas OK</SelectItem>
                <SelectItem value="warning">Com avisos</SelectItem>
                <SelectItem value="error">Com erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {filtered.length} de {logs.length} registro{logs.length === 1 ? "" : "s"}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px]"
                onClick={download}
                disabled={logs.length === 0}
              >
                <Download className="h-3 w-3" /> Exportar JSON
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Limpar todos os logs locais?")) {
                    clear();
                    toast({ title: "Logs limpos" });
                  }
                }}
                disabled={logs.length === 0}
              >
                <Trash2 className="h-3 w-3" /> Limpar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-md border border-border/40 bg-background/40 p-6 text-center">
                <History className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  {logs.length === 0
                    ? "Nenhum dry-run executado ainda."
                    : "Nenhum log corresponde ao filtro."}
                </p>
              </div>
            ) : (
              filtered.map((entry) => <LogRow key={entry.id} entry={entry} />)
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "destructive";
}) {
  const map = {
    muted: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  } as const;
  return (
    <div className="glass rounded-md p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${map[tone]}`}>{value}</p>
    </div>
  );
}

function LogRow({ entry }: { entry: DryRunLogEntry }) {
  const [open, setOpen] = useState(false);
  const date = new Date(entry.timestamp);
  const Icon =
    entry.outcome === "ok" ? CheckCircle2 : entry.outcome === "warning" ? AlertTriangle : AlertCircle;
  const tone =
    entry.outcome === "ok"
      ? "border-success/30 text-success"
      : entry.outcome === "warning"
        ? "border-warning/40 text-warning"
        : "border-destructive/40 text-destructive";

  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${
              entry.outcome === "ok"
                ? "text-success"
                : entry.outcome === "warning"
                  ? "text-warning"
                  : "text-destructive"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium capitalize">{entry.provider}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {entry.scope_type}
              </Badge>
              <Badge variant="outline" className={`text-[9px] h-4 px-1 ${tone}`}>
                {entry.outcome}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
              {entry.redirect_uri}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </button>

      {open && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-2 text-[11px]">
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className={`text-[9px] gap-1 ${entry.client_id_configured ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}
            >
              <KeyRound className="h-2.5 w-2.5" /> client_id {entry.client_id_configured ? "OK" : "ausente"}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[9px] gap-1 ${entry.client_secret_configured ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}
            >
              <KeyRound className="h-2.5 w-2.5" /> secret {entry.client_secret_configured ? "OK" : "ausente"}
            </Badge>
          </div>

          <div>
            <p className="text-muted-foreground mb-1">Scopes ({entry.scopes.length})</p>
            <div className="flex flex-wrap gap-1">
              {entry.scopes.map((s) => (
                <Badge key={s} variant="outline" className="text-[9px] font-mono">
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          {entry.warnings.length > 0 && (
            <div className="rounded border border-warning/30 bg-warning/5 p-2">
              <p className="text-[10px] font-medium text-warning mb-1">
                Warnings ({entry.warnings.length})
              </p>
              <ul className="space-y-0.5 list-disc list-inside text-muted-foreground">
                {entry.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {entry.error && (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-2">
              <p className="text-[10px] font-medium text-destructive mb-1">Erro</p>
              <code className="text-[10px] text-muted-foreground break-all font-mono">
                {entry.error}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}