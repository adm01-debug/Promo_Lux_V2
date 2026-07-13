import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/lux/EmptyState";
import { AutomationStageBadge } from "./AutomationStageBadge";
import { stageStatus, type CompanyAutomationRow } from "@/hooks/useAutomationsMonitor";

/** Matriz por empresa: raspagem, enrichment e localização + último evento. */
export function CompanyAutomationTable({ companies }: { companies: CompanyAutomationRow[] }) {
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name?.toLowerCase().includes(q));
  }, [companies, term]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          className="bg-secondary/20 pl-9"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Buscar empresa"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma empresa encontrada"
          description="Ajuste a busca ou inicie uma raspagem para ver o progresso das automações aqui."
        />
      ) : (
        <ScrollArea className="h-[420px] rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">Estágios</th>
                <th className="px-4 py-2.5 font-medium">IPC</th>
                <th className="px-4 py-2.5 font-medium">Último evento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const st = stageStatus(c);
                return (
                  <tr key={c.id} className="border-b border-border/20 transition-colors hover:bg-secondary/20">
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <AutomationStageBadge stage="scraping" status={st.scraping} />
                        <AutomationStageBadge stage="enrichment" status={st.enrichment} />
                        <AutomationStageBadge stage="localization" status={st.localization} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.ipc_score != null ? (
                        <Badge variant={c.ipc_score >= 75 ? "default" : "outline"}>{c.ipc_score}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
