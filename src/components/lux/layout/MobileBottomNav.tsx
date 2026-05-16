import { View } from "@/hooks/useNavigationHistory";
import { LayoutDashboard, Building2, Bot, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MobileBottomNavProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onOpenMenu: () => void;
}

export const BOTTOM_NAV_TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai-agent", label: "IA", icon: Bot },
];

const tapSpring = { type: "spring" as const, stiffness: 500, damping: 28 };

/** triggerHaptic - Vibração leve para dispositivos suportados */
const triggerHaptic = (style: "light" | "medium" | "heavy" = "light") => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    const pattern = style === "light" ? 10 : style === "medium" ? 20 : 40;
    navigator.vibrate(pattern);
  }
};

export function MobileBottomNav({ activeView, onNavigate, onOpenMenu }: MobileBottomNavProps) {
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const handleNavigate = (id: View) => {
    if (activeView !== id) {
      triggerHaptic("light");
      onNavigate(id);
    }
  };

  const handleOpenMenu = () => {
    triggerHaptic("medium");
    onOpenMenu();
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border/30 bg-background/80 safe-area-bottom backdrop-blur-2xl backdrop-saturate-150"
      aria-label="Navegação rápida"
    >
      {/* Swipe indicator dots */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
        {BOTTOM_NAV_TABS.map(({ id }) => (
          <motion.div
            key={id}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              activeView === id ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
            )}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        ))}
      </div>
      <div className="flex items-center justify-around h-16 px-1">
        {BOTTOM_NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          const showBadge = id === "dashboard" && (unreadCount ?? 0) > 0;

          return (
            <motion.button
              key={id}
              onClick={() => handleNavigate(id)}
              whileTap={{ scale: 0.82 }}
              whileHover={{ scale: 1.05 }}
              transition={tapSpring}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 outline-none",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {/* Active background pill */}
              <AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-x-2 top-1.5 bottom-1.5 rounded-xl bg-primary/10"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>

              <div className="relative z-10">
                <Icon className={cn("h-5 w-5 transition-all duration-200", active && "scale-110")} />

                {/* Notification badge */}
                {showBadge && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] rounded-full bg-destructive flex items-center justify-center border-2 border-background"
                  >
                    <span className="text-[9px] font-bold text-destructive-foreground px-1">
                      {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
                    </span>
                  </motion.div>
                )}

                {active && (
                  <motion.div
                    layoutId="mobile-nav-glow"
                    className="absolute -inset-2.5 rounded-full bg-primary/12 blur-lg"
                    aria-hidden="true"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </div>

              <span className={cn(
                "text-[10px] font-medium relative z-10 transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {label}
              </span>

              {active && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 w-8 h-0.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}

        <motion.button
          onClick={handleOpenMenu}
          whileTap={{ scale: 0.82 }}
          whileHover={{ scale: 1.05 }}
          transition={tapSpring}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors duration-200 outline-none"
          aria-label="Mais opções"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </motion.button>
      </div>
    </nav>
  );
}
