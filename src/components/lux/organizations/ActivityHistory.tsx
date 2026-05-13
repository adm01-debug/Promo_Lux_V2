import { motion } from "framer-motion";
import { History, UserCog, X, RefreshCw, Trash2, Activity } from "lucide-react";

interface ActivityEntry {
  id: string;
  at: number;
  icon: "role" | "revoke" | "resend" | "remove" | "create";
  title: string;
  detail: string;
}

interface ActivityHistoryProps {
  activity: ActivityEntry[];
  onClear: () => void;
}

export const ActivityHistory = ({ activity, onClear }: ActivityHistoryProps) => {
  if (activity.length === 0) return null;

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Atividade recente desta sessão
        </h3>
        <button
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Limpar
        </button>
      </div>
      <ul className="divide-y divide-border/20">
        {activity.map((a) => {
          const Icon =
            a.icon === "role" ? UserCog
            : a.icon === "revoke" ? X
            : a.icon === "resend" ? RefreshCw
            : a.icon === "remove" ? Trash2
            : Activity;
          const tone =
            a.icon === "revoke" || a.icon === "remove" ? "text-destructive bg-destructive/10"
            : a.icon === "role" ? "text-info bg-info/10"
            : "text-primary bg-primary/10";
          return (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 flex items-start gap-3"
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{a.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{a.detail}</p>
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                {new Date(a.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <div className="px-4 py-2 border-t border-border/30 bg-secondary/10 text-[10px] text-muted-foreground">
        Histórico em memória (limpa ao recarregar). Para auditoria completa, consulte os logs em Configurações.
      </div>
    </div>
  );
};
