import { Building2, Search, Sparkles, MapPin, ListChecks, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AutomationKpis } from "@/hooks/useAutomationsMonitor";

interface CardDef {
  label: string;
  value: number;
  hint?: string;
  icon: typeof Building2;
  tone: "primary" | "muted" | "warning";
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

/** Cartões de KPI do topo da tela de automações. */
export function AutomationKpiCards({ kpis }: { kpis: AutomationKpis }) {
  const cards: CardDef[] = [
    { label: "Empresas", value: kpis.totalCompanies, icon: Building2, tone: "muted" },
    { label: "Raspadas", value: kpis.scraped, hint: pct(kpis.scraped, kpis.totalCompanies), icon: Search, tone: "primary" },
    { label: "Enriquecidas", value: kpis.enriched, hint: pct(kpis.enriched, kpis.totalCompanies), icon: Sparkles, tone: "primary" },
    { label: "Localizadas", value: kpis.located, hint: pct(kpis.located, kpis.totalCompanies), icon: MapPin, tone: "primary" },
    { label: "Na fila", value: kpis.queued, icon: ListChecks, tone: "muted" },
    { label: "Processando", value: kpis.processing, icon: Loader2, tone: "muted" },
    { label: "Erros (DLQ)", value: kpis.errors, icon: AlertTriangle, tone: "warning" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="glass border-border/40">
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    c.tone === "primary" && "text-primary",
                    c.tone === "warning" && "text-destructive",
                    c.tone === "muted" && "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span className="text-2xl font-bold tabular-nums">{c.value}</span>
              {c.hint && <span className="text-[11px] text-muted-foreground">{c.hint} do total</span>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
