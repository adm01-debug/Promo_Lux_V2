import { RefreshCw, Radio, Building2, ListChecks, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AutomationKpiCards } from "./AutomationKpiCards";
import { CompanyAutomationTable } from "./CompanyAutomationTable";
import { AutomationQueuePanel } from "./AutomationQueuePanel";
import { AutomationEventsFeed } from "./AutomationEventsFeed";
import { useAutomationsMonitor } from "@/hooks/useAutomationsMonitor";

/**
 * Tela "Automações em Tempo Real": status por empresa (raspagem, enrichment e
 * localização), fila de execução com tentativas/erros e o fluxo de eventos —
 * tudo atualizado ao vivo via Realtime.
 */
export function AutomationsRealtimeView() {
  const { companies, queue, events, kpis, isLoading, refetchAll } = useAutomationsMonitor();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Automações em Tempo Real
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" />
              Ao vivo
            </span>
          </div>
          <p className="text-muted-foreground">
            Acompanhe raspagem, enrichment e localização por empresa, com fila, tentativas, erros e eventos.
          </p>
        </div>
        <Button variant="outline" onClick={refetchAll} disabled={isLoading} className="gap-2">
          <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      <AutomationKpiCards kpis={kpis} />

      <Card className="glass border-border/40">
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="companies" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Por Empresa
              </TabsTrigger>
              <TabsTrigger value="queue" className="gap-2">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Fila & Tentativas
                {queue.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] tabular-nums text-primary">
                    {queue.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <Terminal className="h-4 w-4" aria-hidden="true" />
                Eventos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
              <CompanyAutomationTable companies={companies} />
            </TabsContent>
            <TabsContent value="queue">
              <AutomationQueuePanel queue={queue} />
            </TabsContent>
            <TabsContent value="events">
              <AutomationEventsFeed events={events} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default AutomationsRealtimeView;
