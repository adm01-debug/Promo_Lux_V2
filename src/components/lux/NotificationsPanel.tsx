import { useState, useMemo, useEffect, useCallback } from "react";
import { Bell, Radar, Zap, Building2, CheckCircle2, X, Trash2, Clock } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type NotificationType = "signal" | "scrape" | "enrichment" | "system";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const iconMap: Record<string, React.ReactNode> = {
  signal: <Radar className="h-4 w-4 text-primary" />,
  scrape: <Zap className="h-4 w-4 text-success" />,
  enrichment: <Building2 className="h-4 w-4 text-accent-foreground" />,
  system: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const typeLabels: Record<string, string> = {
  signal: "Sinal",
  scrape: "Raspagem",
  enrichment: "Enriquecimento",
  system: "Sistema",
};

function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: ptBR });
  } catch {
    return "";
  }
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

const NOTIFICATIONS_KEY = ["notifications"];

export const NotificationsPanel = ({ open, onClose }: NotificationsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"all" | NotificationType>("all");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
          queryClient.invalidateQueries({ queryKey: ["notifications-count"] });

          if (payload.eventType === "INSERT") {
            const n = payload.new as Notification;
            toast({
              title: n.title,
              description: n.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    invalidateAll();
  }, [notifications, invalidateAll]);

  const markRead = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      invalidateAll();
    },
    [invalidateAll]
  );

  const dismiss = useCallback(
    async (id: string) => {
      await supabase.from("notifications").delete().eq("id", id);
      invalidateAll();
    },
    [invalidateAll]
  );

  const clearAll = useCallback(async () => {
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    invalidateAll();
  }, [invalidateAll]);

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
                {isLoading ? (
                  <div className="p-12 text-center">
                    <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center">
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
                        onClick={() => !n.read && markRead(n.id)}
                        className={cn(
                          "p-4 flex items-start gap-3 cursor-pointer transition-colors group",
                          "hover:bg-secondary/20",
                          !n.read && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0 rounded-lg bg-secondary/40 p-2">
                          {iconMap[n.type] ?? iconMap.system}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                "text-xs font-medium truncate",
                                !n.read ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {n.title}
                            </p>
                            {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 border-border/30 text-muted-foreground/60"
                            >
                              {typeLabels[n.type] ?? n.type}
                            </Badge>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
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
  const { data } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (error) throw error;
      return data?.length ?? 0;
    },
    refetchInterval: 30_000,
  });
  return data ?? 0;
};
