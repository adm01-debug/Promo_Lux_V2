import { CheckCircle2, AlertCircle, Zap, Database, Bell } from "lucide-react";
import { useRecentActivity } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const iconMap: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  system: <Zap className="h-3.5 w-3.5 text-primary" />,
  enrichment: <Database className="h-3.5 w-3.5 text-purple-400" />,
};

export const ActivityFeed = () => {
  const { data: activities, isLoading } = useRecentActivity();

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground text-sm">Atividade Recente</h3>
        <p className="text-xs text-muted-foreground">Feed em tempo real</p>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
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
          {activities.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
              <div className="mt-0.5">{iconMap[a.type] ?? iconMap.system}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{a.message}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
