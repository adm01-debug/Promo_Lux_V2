import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { prefetchView } from "@/lib/viewRegistry";
import {
  Sparkles,
  LayoutDashboard,
  Target,
  Workflow,
  Building2,
  BarChart3,
  Radar,
  Mail,
  Bot,
  MapPin,
  Globe,
  Users,
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { View } from "@/hooks/useNavigationHistory";

export interface NavItem {
  id: View;
  label: string;
  icon: React.ElementType;
  section?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Principal" },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "icp", label: "Configurar IPC", icon: Target, section: "Prospecção" },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "intent", label: "Sinais de Intenção", icon: Radar },
  { id: "stakeholders", label: "Stakeholders", icon: Users },
  { id: "workflows", label: "Workflows", icon: Workflow, section: "Automação" },
  { id: "gmaps", label: "Google Maps", icon: MapPin },
  { id: "map", label: "Mapa de Empresas", icon: Globe },
  { id: "campaigns", label: "Campanhas", icon: Mail },
  { id: "ai-agent", label: "Agente IA", icon: Bot },
  { id: "settings", label: "Configurações", icon: Settings, section: "Sistema" },
];

const SHORTCUT_VIEWS: View[] = [
  "dashboard", "analytics", "icp", "companies", "intent",
  "stakeholders", "workflows", "gmaps", "settings",
];

const getShortcut = (id: View): string | null => {
  const idx = SHORTCUT_VIEWS.indexOf(id);
  return idx >= 0 ? `Alt+${idx + 1}` : null;
};

interface SidebarProps {
  activeView: View;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (view: View) => void;
  onMobileClose: () => void;
  onToggleCollapse: () => void;
}

export const Sidebar = ({
  activeView,
  collapsed,
  mobileOpen,
  onNavigate,
  onMobileClose,
  onToggleCollapse,
}: SidebarProps) => {
  // Pre-compute grouped nav items to avoid mutable variable during render
  const groupedItems = useMemo(() => {
    let lastSection = "";
    return NAV_ITEMS.map((item) => {
      const showSection = !!item.section && item.section !== lastSection;
      if (item.section) lastSection = item.section;
      return { ...item, showSection };
    });
  }, []);

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <aside
      aria-label="Navegação principal"
      role="navigation"
      className={cn(
        "border-r border-border glass flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300",
        sidebarWidth,
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className={cn("p-5 border-b border-border", collapsed && "p-3")}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-xl bg-primary/10 flex items-center justify-center glow-primary shrink-0",
              collapsed ? "h-8 w-8" : "h-10 w-10"
            )}
          >
            <Sparkles className={cn(collapsed ? "h-4 w-4" : "h-5 w-5", "text-primary")} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                LUX <span className="text-primary glow-text">IA</span>
              </h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Sales Intelligence Platform
              </p>
            </div>
          )}
          <button
            onClick={onMobileClose}
            className="lg:hidden ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-2 space-y-1" : "p-3 space-y-0.5")}>
        {groupedItems.map((item) => (
          <div key={item.id}>
            {item.showSection && !collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1.5 font-medium">
                {item.section}
              </p>
            )}
            {collapsed ? (
              <CollapsedNavButton
                item={item}
                isActive={activeView === item.id}
                onClick={() => onNavigate(item.id)}
                onPrefetch={() => prefetchView(item.id)}
              />
            ) : (
              <ExpandedNavButton
                item={item}
                isActive={activeView === item.id}
                onClick={() => onNavigate(item.id)}
                onPrefetch={() => prefetchView(item.id)}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
};

/* Dynamic footer with live workflow count */
function SidebarFooter({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const { data: activeCount = 0 } = useQuery({
    queryKey: ["active-workflows-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("workflows")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
      {!collapsed && (
        <div className="glass rounded-lg p-3 mb-3">
          <p className="text-xs text-muted-foreground">Status do Sistema</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn("h-2 w-2 rounded-full animate-pulse", activeCount > 0 ? "bg-success" : "bg-muted-foreground")} />
            <span className={cn("text-xs font-medium", activeCount > 0 ? "text-success" : "text-muted-foreground")}>
              {activeCount > 0 ? `Online — ${activeCount} workflow${activeCount !== 1 ? "s" : ""} ativo${activeCount !== 1 ? "s" : ""}` : "Nenhum workflow ativo"}
            </span>
          </div>
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/* Sub-components */

function CollapsedNavButton({
  item,
  isActive,
  onClick,
  onPrefetch,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  onPrefetch: () => void;
}) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-tour={item.id}
          onClick={onClick}
          onMouseEnter={onPrefetch}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "w-full flex items-center justify-center p-2 rounded-lg transition-all duration-200 active:scale-95",
            isActive
              ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 hover:scale-105"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function ExpandedNavButton({
  item,
  isActive,
  onClick,
  onPrefetch,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  onPrefetch: () => void;
}) {
  const Icon = item.icon;
  const shortcut = getShortcut(item.id);

  const btn = (
    <button
      data-tour={item.id}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98]",
        isActive
          ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 hover:translate-x-0.5"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
      {shortcut && (
        <kbd className="ml-auto text-[9px] font-mono text-muted-foreground hidden lg:inline">
          {shortcut}
        </kbd>
      )}
      {item.id === "intent" && (
        <span
          className={cn(
            "text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-bold",
            shortcut ? "" : "ml-auto"
          )}
        >
          5
        </span>
      )}
    </button>
  );

  if (shortcut) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}{" "}
          <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">
            {shortcut}
          </kbd>
        </TooltipContent>
      </Tooltip>
    );
  }

  return btn;
}
