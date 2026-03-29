import { ArrowDown, Database, Filter, CheckCircle2 } from "lucide-react";

const stages = [
  { label: "Raspadas", value: 1847, icon: <Database className="h-4 w-4" />, color: "text-blue-400", bg: "bg-blue-500/10", bar: "bg-blue-500/60", pct: 100 },
  { label: "Enriquecidas", value: 1340, icon: <Database className="h-4 w-4" />, color: "text-purple-400", bg: "bg-purple-500/10", bar: "bg-purple-500/60", pct: 73 },
  { label: "Filtradas IPC", value: 892, icon: <Filter className="h-4 w-4" />, color: "text-primary", bg: "bg-primary/10", bar: "bg-primary/60", pct: 48 },
  { label: "Qualificadas", value: 567, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-success", bg: "bg-success/10", bar: "bg-success/60", pct: 31 },
];

export const EnrichmentFunnel = () => {
  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground text-sm">Funil de Enriquecimento</h3>
        <p className="text-xs text-muted-foreground">Inspirado no Waterfall do Clay</p>
      </div>
      <div className="p-5 space-y-3">
        {stages.map((stage, i) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded flex items-center justify-center ${stage.bg} ${stage.color}`}>
                  {stage.icon}
                </div>
                <span className="text-xs font-medium text-foreground">{stage.label}</span>
              </div>
              <span className="font-mono text-sm font-bold text-foreground">{stage.value.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${stage.bar}`} style={{ width: `${stage.pct}%` }} />
            </div>
            {i < stages.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
