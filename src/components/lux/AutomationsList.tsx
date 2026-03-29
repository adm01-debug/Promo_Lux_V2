import { Play, Pause, RotateCcw, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AutomationStatus = "running" | "paused" | "completed" | "error";

interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  progress: number;
  lastRun: string;
  companiesFound: number;
}

const statusConfig: Record<AutomationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  running: { label: "Executando", color: "bg-success/20 text-success border-success/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning border-warning/30", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Concluído", color: "bg-primary/20 text-primary border-primary/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> },
};

const mockAutomations: Automation[] = [
  { id: "1", name: "Raspagem LinkedIn — Tech B2B", status: "running", progress: 67, lastRun: "Agora", companiesFound: 142 },
  { id: "2", name: "Google Maps — Restaurantes SP", status: "running", progress: 34, lastRun: "Agora", companiesFound: 89 },
  { id: "3", name: "Crawler — E-commerce Fashion", status: "paused", progress: 50, lastRun: "2h atrás", companiesFound: 231 },
  { id: "4", name: "API CNPJ — Varejo Nacional", status: "completed", progress: 100, lastRun: "4h atrás", companiesFound: 567 },
  { id: "5", name: "Scraper — SaaS Companies US", status: "error", progress: 12, lastRun: "1h atrás", companiesFound: 18 },
];

export const AutomationsList = () => {
  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Automações</h2>
            <p className="text-sm text-muted-foreground">Gerencie suas raspagens e buscas</p>
          </div>
          <Button size="sm" className="gap-2">
            <Play className="h-3.5 w-3.5" />
            Nova Automação
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {mockAutomations.map((auto) => {
          const config = statusConfig[auto.status];
          return (
            <div key={auto.id} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm text-foreground">{auto.name}</span>
                  <Badge variant="outline" className={`text-xs ${config.color} gap-1`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {auto.status === "running" ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {auto.lastRun}
                </span>
                <span>{auto.companiesFound} empresas</span>
                <span>{auto.progress}%</span>
              </div>

              {auto.status === "running" && (
                <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${auto.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
