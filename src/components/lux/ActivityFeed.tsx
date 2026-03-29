import { CheckCircle2, AlertCircle, Zap, Building2, Database } from "lucide-react";

interface Activity {
  id: string;
  type: "success" | "error" | "info" | "enrichment";
  message: string;
  time: string;
}

const iconMap = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  info: <Zap className="h-3.5 w-3.5 text-primary" />,
  enrichment: <Database className="h-3.5 w-3.5 text-purple-400" />,
};

const activities: Activity[] = [
  { id: "1", type: "success", message: "142 empresas raspadas do LinkedIn", time: "Agora" },
  { id: "2", type: "enrichment", message: "Waterfall: 89 emails encontrados via Hunter", time: "2 min" },
  { id: "3", type: "info", message: "Workflow 'Google Maps SP' iniciado", time: "5 min" },
  { id: "4", type: "success", message: "TechNova Solutions — Score IPC: 94", time: "8 min" },
  { id: "5", type: "error", message: "Timeout na raspagem de instagram.com", time: "12 min" },
  { id: "6", type: "enrichment", message: "Dados CNPJ enriquecidos: 45 empresas", time: "15 min" },
  { id: "7", type: "success", message: "567 empresas exportadas para o CRM", time: "1h" },
  { id: "8", type: "info", message: "Auto-busca IPC detectou 12 novos matches", time: "2h" },
];

export const ActivityFeed = () => {
  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground text-sm">Atividade Recente</h3>
        <p className="text-xs text-muted-foreground">Feed em tempo real</p>
      </div>
      <div className="divide-y divide-border/20 max-h-[400px] overflow-y-auto">
        {activities.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
            <div className="mt-0.5">{iconMap[a.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">{a.message}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
