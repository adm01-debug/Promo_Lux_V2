import { ArrowDown, Database, Filter, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_FUNNEL } from "@/lib/demoData";

export const EnrichmentFunnel = () => {
  const { isDemoMode } = useDemo();

  const { data, isLoading } = useQuery({
    queryKey: ["enrichment-funnel", isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_FUNNEL
      : async () => {
          const [
            { count: total },
            { count: enriched },
            { count: highScore },
            { count: qualified },
          ] = await Promise.all([
            supabase.from("companies").select("*", { count: "exact", head: true }),
            supabase.from("companies").select("*", { count: "exact", head: true }).eq("enriched", true),
            supabase.from("companies").select("*", { count: "exact", head: true }).gte("ipc_score", 60),
            supabase.from("companies").select("*", { count: "exact", head: true }).gte("ipc_score", 75),
          ]);
          return {
            total: total ?? 0,
            enriched: enriched ?? 0,
            highScore: highScore ?? 0,
            qualified: qualified ?? 0,
          };
        },
    staleTime: isDemoMode ? Infinity : 15_000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <Skeleton className="h-4 w-40 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="p-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-12" /></div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const d = data!;
  const base = Math.max(d.total, 1);

  const stages = [
    { label: "Raspadas", value: d.total, icon: <Database className="h-4 w-4" />, color: "text-blue-400", bg: "bg-blue-500/10", bar: "from-blue-600 to-blue-400", pct: 100 },
    { label: "Enriquecidas", value: d.enriched, icon: <Database className="h-4 w-4" />, color: "text-purple-400", bg: "bg-purple-500/10", bar: "from-purple-600 to-purple-400", pct: Math.round((d.enriched / base) * 100) },
    { label: "Filtradas IPC", value: d.highScore, icon: <Filter className="h-4 w-4" />, color: "text-primary", bg: "bg-primary/10", bar: "from-primary to-accent", pct: Math.round((d.highScore / base) * 100) },
    { label: "Qualificadas", value: d.qualified, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-success", bg: "bg-success/10", bar: "from-emerald-600 to-emerald-400", pct: Math.round((d.qualified / base) * 100) },
  ];

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Funil de Enriquecimento</h3>
          <p className="text-xs text-muted-foreground">Pipeline waterfall</p>
        </div>
        {d.total > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="text-[9px] font-mono text-success bg-success/10 px-2.5 py-1 rounded-full font-medium"
          >
            {Math.round((d.qualified / base) * 100)}% conv.
          </motion.span>
        )}
      </div>
      <div className="p-5 space-y-3">
        {stages.map((stage, i) => (
          <motion.div key={stage.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 6 }}
                  transition={{ type: "spring", stiffness: 400 }}
                  className={`h-6 w-6 rounded flex items-center justify-center ${stage.bg} ${stage.color}`}
                >
                  {stage.icon}
                </motion.div>
                <span className="text-xs font-medium text-foreground">{stage.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">{stage.value.toLocaleString()}</span>
                {i > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-full">
                    {stage.pct}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2.5 bg-secondary/40 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${stage.bar} shadow-sm`}
                initial={{ width: 0 }}
                animate={{ width: `${stage.pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: "easeOut" }}
              />
            </div>
            {i < stages.length - 1 && (
              <div className="flex justify-center py-1.5">
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                >
                  <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
                </motion.div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
