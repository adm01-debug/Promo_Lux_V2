import { useState, useEffect, useCallback } from "react";
import { Bell, Radar, Zap, Building2, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  type: "signal" | "scrape" | "enrichment" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const iconMap = {
  signal: <Radar className="h-4 w-4 text-primary" />,
  scrape: <Zap className="h-4 w-4 text-success" />,
  enrichment: <Building2 className="h-4 w-4 text-purple-400" />,
  system: <CheckCircle2 className="h-4 w-4 text-blue-400" />,
};

const initialNotifications: Notification[] = [
  { id: "1", type: "signal", title: "Sinal de alta intenção", message: "TechNova Solutions visitou pricing 3x", time: "Agora", read: false },
  { id: "2", type: "scrape", title: "Raspagem concluída", message: "142 empresas encontradas via LinkedIn", time: "2 min", read: false },
  { id: "3", type: "enrichment", title: "Enriquecimento finalizado", message: "89 emails verificados via waterfall", time: "5 min", read: false },
  { id: "4", type: "system", title: "Workflow ativado", message: "Google Maps → Enrichment está rodando", time: "10 min", read: true },
  { id: "5", type: "signal", title: "Nova empresa detectada", message: "CloudBridge Inc — Score IPC 85", time: "15 min", read: true },
];

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationsPanel = ({ open, onClose }: NotificationsPanelProps) => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 glass rounded-lg border border-border/50 shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Notificações</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{iconMap[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                    </div>
                    <button onClick={() => dismiss(n.id)} className="text-muted-foreground/40 hover:text-foreground flex-shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const useNotificationCount = () => {
  return initialNotifications.filter(n => !n.read).length;
};
