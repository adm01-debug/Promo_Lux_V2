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

export function MobileBottomNav({ activeView, onNavigate, onOpenMenu }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border/50 glass safe-area-bottom backdrop-blur-xl"
      aria-label="Navegação rápida"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground active:scale-90"
              )}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-transform duration-200", active && "scale-110")} />
                {active && (
                  <motion.div
                    layoutId="mobile-nav-glow"
                    className="absolute -inset-2 rounded-full bg-primary/10 blur-md"
                    aria-hidden="true"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {label}
              </span>
              {active && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 w-10 h-0.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-all duration-200 active:scale-90"
          aria-label="Mais opções"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </div>
    </nav>
  );
}
