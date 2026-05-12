import { memo } from "react";
import { CheckCircle2, AlertCircle, Zap, Database, Bell, Clock, TrendingUp } from "lucide-react";
import { useRecentActivity, type ActivityItem } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { GradientAvatar } from "@/components/lux/GradientAvatar";

const iconMap: Record<string, { icon: React.ReactNode; bg: string; ring: string }> = {
  success: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, bg: "bg-success/10", ring: "ring-success/30" },
  error: { icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" />, bg: "bg-destructive/10", ring: "ring-destructive/30" },
  system: { icon: <Zap className="h-3.5 w-3.5 text-primary" />, bg: "bg-primary/10", ring: "ring-primary/30" },
  enrichment: { icon: <Database className="h-3.5 w-3.5 text-accent-foreground" />, bg: "bg-accent/10", ring: "ring-accent/30" },
  signal: { icon: <Bell className="h-3.5 w-3.5 text-amber-500" />, bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  deal: { icon: <TrendingUp className="h-3.5 w-3.5 text-blue-500" />, bg: "bg-blue-500/10", ring: "ring-blue-500/30" },
};

export const ActivityFeed = memo(() => {
  const { data: activities, isLoading } = useRecentActivity();

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Timeline de Atividades</h3>
            <p className="text-xs text-muted-foreground">Feed em tempo real</p>
          </div>
        </div>
        {activities && activities.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 500, damping: 20 }}
            className="text-[9px] font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium"
          >
            {activities.length} eventos
          </motion.span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 pl-6">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-20" />
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
        <div className="relative max-h-[420px] overflow-y-auto scrollbar-thin">
          {/* Animated vertical timeline line */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-[23px] top-4 bottom-4 w-px origin-top"
          >
            <div className="h-full w-full bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
            {/* Animated pulse traveling down the line */}
            <motion.div
              className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-primary/60 to-transparent"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>

          <div className="py-3">
            {activities.map((a, i) => {
              const entry = iconMap[a.type] ?? iconMap.system;
              const isFirst = i === 0;

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -16, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: i * 0.07, duration: 0.35 }}
                  whileHover={{ x: 4 }}
                  className="relative flex items-start gap-3 px-4 py-3 hover:bg-secondary/15 transition-colors group cursor-default"
                >
                  {/* Timeline dot */}
                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.07 + 0.1, type: "spring" as const, stiffness: 400, damping: 15 }}
                      className={`h-[10px] w-[10px] rounded-full ring-2 ${entry.ring} ${entry.bg} shrink-0 mt-1.5`}
                    >
                      {isFirst && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-primary/30"
                          animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  </div>

                  {/* Avatar */}
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.07 + 0.15, type: "spring" as const, stiffness: 300, damping: 20 }}
                    className="shrink-0"
                  >
                    <div className="relative">
                      <GradientAvatar name={a.title || a.type} size="sm" className="ring-1 ring-border/30" />
                      <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ${entry.bg} ring-1 ring-background`}>
                        {entry.icon}
                      </div>
                    </div>
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed group-hover:text-foreground/90">
                      {a.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${entry.bg} text-muted-foreground`}>
                        {a.type}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
