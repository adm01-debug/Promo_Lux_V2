import { View } from "@/hooks/useNavigationHistory";
import { LayoutDashboard, Building2, Bot, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border glass safe-area-bottom"
      aria-label="Navegação rápida"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <div className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors"
          aria-label="Mais opções"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </div>
    </nav>
  );
}
