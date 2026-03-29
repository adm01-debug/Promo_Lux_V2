import { ArrowDown, Database, Filter, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

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
        <p className="text-xs text-muted-foreground">Waterfall pipeline</p>
      </div>
      <div className="p-5 space-y-3">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded flex items-center justify-center ${stage.bg} ${stage.color}`}>
                  {stage.icon}
                </div>
                <span className="text-xs font-medium text-foreground">{stage.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">{stage.value.toLocaleString()}</span>
                {i > 0 && (
                  <span className="text-[10px] text-muted-foreground">({stage.pct}%)</span>
                )}
              </div>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${stage.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${stage.pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.15 }}
              />
            </div>
            {i < stages.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
