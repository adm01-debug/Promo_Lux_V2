import { useState, useMemo } from "react";
import { Bell, Radar, Zap, Building2, CheckCircle2, X, Filter, Trash2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type NotificationType = "signal" | "scrape" | "enrichment" | "system";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  timestamp: Date;
}

const iconMap: Record<NotificationType, React.ReactNode> = {
  signal: <Radar className="h-4 w-4 text-primary" />,
  scrape: <Zap className="h-4 w-4 text-success" />,
  enrichment: <Building2 className="h-4 w-4 text-accent-foreground" />,
  system: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const typeLabels: Record<NotificationType, string> = {
  signal: "Sinal",
  scrape: "Raspagem",
  enrichment: "Enriquecimento",
  system: "Sistema",
};

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const initialNotifications: Notification[] = [
  { id: "1", type: "signal", title: "Sinal de alta intenção", message: "TechNova Solutions visitou pricing 3x em 24h — score subiu para 92", time: "Agora", read: false, timestamp: minutesAgo(0) },
  { id: "2", type: "scrape", title: "Raspagem concluída", message: "142 empresas encontradas via LinkedIn • 89% com email válido", time: "2 min", read: false, timestamp: minutesAgo(2) },
  { id: "3", type: "enrichment", title: "Enriquecimento finalizado", message: "89 emails verificados via waterfall — 12 bounce detectados", time: "5 min", read: false, timestamp: minutesAgo(5) },
  { id: "4", type: "system", title: "Workflow ativado", message: "Google Maps → Enrichment pipeline está rodando", time: "10 min", read: true, timestamp: minutesAgo(10) },
  { id: "5", type: "signal", title: "Nova empresa detectada", message: "CloudBridge Inc — Score IPC 85 • Setor: SaaS B2B", time: "15 min", read: true, timestamp: minutesAgo(15) },
  { id: "6", type: "scrape", title: "Google Maps finalizado", message: "78 restaurantes em São Paulo coletados com sucesso", time: "32 min", read: true, timestamp: minutesAgo(32) },
  { id: "7", type: "system", title: "Campanha enviada", message: "Cold outreach lote #4 — 230 emails despachados", time: "1h", read: true, timestamp: minutesAgo(60) },
  { id: "8", type: "enrichment", title: "Stakeholders encontrados", message: "14 decisores mapeados para TechNova Solutions", time: "2h", read: true, timestamp: minutesAgo(120) },
];

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationsPanel = ({ open, onClose }: NotificationsPanelProps) => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeTab, setActiveTab] = useState<"all" | NotificationType>("all");

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter(n => n.type === activeTab);
  }, [notifications, activeTab]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col border-border/50 bg-background">
        <SheetHeader className="p-4 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <SheetTitle className="text-base">Notificações</SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px] px-1.5 py-0 h-5">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-[11px] h-7 text-primary" onClick={markAllRead}>
                  Marcar lidas
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <SheetDescription className="sr-only">Painel de notificações e atividades recentes</SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-2 shrink-0">
            <TabsList className="w-full bg-secondary/30 h-8">
              <TabsTrigger value="all" className="text-[11px] h-6 flex-1">Todas</TabsTrigger>
              <TabsTrigger value="signal" className="text-[11px] h-6 flex-1">Sinais</TabsTrigger>
              <TabsTrigger value="scrape" className="text-[11px] h-6 flex-1">Raspagem</TabsTrigger>
              <TabsTrigger value="system" className="text-[11px] h-6 flex-1">Sistema</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <TabsContent value={activeTab} className="mt-0 p-0">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-12 text-center"
                  >
                    <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Atividades do workspace aparecerão aqui</p>
                  </motion.div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {filtered.map((n) => (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => markRead(n.id)}
                        className={cn(
                          "p-4 flex items-start gap-3 cursor-pointer transition-colors group",
                          "hover:bg-secondary/20",
                          !n.read && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0 rounded-lg bg-secondary/40 p-2">
                          {iconMap[n.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-xs font-medium truncate",
                              !n.read ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[10px] text-muted-foreground/60">{n.time}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border/30 text-muted-foreground/60">
                              {typeLabels[n.type]}
                            </Badge>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          className="text-muted-foreground/30 hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export const useNotificationCount = () => {
  return initialNotifications.filter(n => !n.read).length;
};
