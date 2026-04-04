import { View } from "@/hooks/useNavigationHistory";
import { LayoutDashboard, Building2, Bot, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MobileBottomNavProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onOpenMenu: () => void;
}

const TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai-agent", label: "IA", icon: Bot },
];

const tapSpring = { type: "spring" as const, stiffness: 500, damping: 28 };

export function MobileBottomNav({ activeView, onNavigate, onOpenMenu }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border/30 bg-background/80 safe-area-bottom backdrop-blur-2xl backdrop-saturate-150"
      aria-label="Navegação rápida"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <motion.button
              key={id}
              onClick={() => onNavigate(id)}
              whileTap={{ scale: 0.85 }}
              transition={tapSpring}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {/* Active background pill */}
              {active && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-x-2 top-1.5 bottom-1.5 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  aria-hidden="true"
                />
              )}
              <div className="relative z-10">
                <Icon className={cn("h-5 w-5 transition-transform duration-200", active && "scale-110")} />
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
          onClick={onOpenMenu}
          whileTap={{ scale: 0.85 }}
          transition={tapSpring}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors duration-200"
          aria-label="Mais opções"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </motion.button>
      </div>
    </nav>
  );
}
