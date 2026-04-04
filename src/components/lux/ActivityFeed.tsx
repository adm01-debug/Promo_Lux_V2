import { CheckCircle2, AlertCircle, Zap, Database, Bell } from "lucide-react";
import { useRecentActivity } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

const iconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
  success: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, bg: "bg-success/10" },
  error: { icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" />, bg: "bg-destructive/10" },
  system: { icon: <Zap className="h-3.5 w-3.5 text-primary" />, bg: "bg-primary/10" },
  enrichment: { icon: <Database className="h-3.5 w-3.5 text-violet-400" />, bg: "bg-violet-500/10" },
};

export const ActivityFeed = () => {
  const { data: activities, isLoading } = useRecentActivity();

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Atividade Recente</h3>
          <p className="text-xs text-muted-foreground">Feed em tempo real</p>
        </div>
        {activities && activities.length > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            {activities.length} eventos
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-lg mt-0.5" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sem atividades"
          description="Notificações e eventos aparecerão aqui conforme o sistema operar."
        />
      ) : (
        <div className="divide-y divide-border/20 max-h-[400px] overflow-y-auto">
          {activities.map((a, i) => {
            const entry = iconMap[a.type] ?? iconMap.system;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors group"
              >
                <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${entry.bg}`}>
                  {entry.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{a.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
