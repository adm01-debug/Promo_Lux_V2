import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
  Users2,
  Database,
  Settings,
  Kanban,
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
  { id: "scrape-results", label: "Resultados Raspagem", icon: Database },
  { id: "map", label: "Mapa de Empresas", icon: Globe },
  { id: "campaigns", label: "Campanhas", icon: Mail },
  { id: "ai-agent", label: "Agente IA", icon: Bot },
  { id: "organizations", label: "Workspaces", icon: Users2, section: "Sistema" },
  { id: "settings", label: "Configurações", icon: Settings },
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

export const Sidebar = memo(({
  activeView,
  collapsed,
  mobileOpen,
  onNavigate,
  onMobileClose,
  onToggleCollapse,
}: SidebarProps) => {
  // Live intent signal count for badge
  const { data: intentCount = 0 } = useQuery({
    queryKey: ["intent-signals-unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("intent_signals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
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
        "border-r border-border/40 bg-sidebar-background/95 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        sidebarWidth,
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0 w-64 shadow-2xl shadow-background/80" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className={cn("p-5 border-b border-border", collapsed && "p-3")}>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={cn(
              "rounded-xl bg-primary/10 flex items-center justify-center glow-primary shrink-0",
              collapsed ? "h-8 w-8" : "h-10 w-10"
            )}
          >
            <Sparkles className={cn(collapsed ? "h-4 w-4" : "h-5 w-5", "text-primary")} />
          </motion.div>
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
          <div key={item.id} role={item.showSection ? "group" : undefined} aria-label={item.showSection && !collapsed ? item.section : undefined}>
            {item.showSection && !collapsed && (
              <div className="px-3 pt-5 pb-2 flex items-center gap-2" role="presentation">
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold" id={`nav-section-${item.section?.replace(/\s/g, "-").toLowerCase()}`}>
                  {item.section}
                </p>
                <div className="flex-1 h-px bg-border/30" />
              </div>
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
                intentCount={item.id === "intent" ? intentCount : 0}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
});

/* Dynamic footer with live workflow count */
function SidebarFooter({ collapsed, onToggleCollapse, ref }: { collapsed: boolean; onToggleCollapse: () => void; ref?: React.Ref<HTMLDivElement> }) {
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
    <div ref={ref} className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
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
        <motion.button
          data-tour={item.id}
          onClick={onClick}
          onMouseEnter={onPrefetch}
          aria-current={isActive ? "page" : undefined}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
          className={cn(
            "w-full flex items-center justify-center p-2 rounded-lg transition-all duration-200",
            isActive
              ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <Icon className="h-4 w-4" />
        </motion.button>
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
  intentCount = 0,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  onPrefetch: () => void;
  intentCount?: number;
}) {
  const Icon = item.icon;
  const shortcut = getShortcut(item.id);

  const btn = (
    <motion.button
      data-tour={item.id}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      aria-current={isActive ? "page" : undefined}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
      className={cn(
        "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 rounded-lg bg-primary/15 border border-primary/25 shadow-[0_0_16px_hsl(var(--primary)/0.18)]"
          transition={{ type: "spring" as const, stiffness: 350, damping: 30 }}
          aria-hidden="true"
        />
      )}
      <motion.div
        className="relative z-10"
        animate={isActive ? { rotate: [0, -8, 8, 0] } : {}}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Icon className="h-4 w-4" />
      </motion.div>
      <span className="relative z-10">{item.label}</span>
      {shortcut && (
        <kbd className="ml-auto text-[9px] font-mono text-muted-foreground hidden lg:inline relative z-10">
          {shortcut}
        </kbd>
      )}
      {item.id === "intent" && intentCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 500, damping: 20 }}
          className={cn(
            "text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-bold relative z-10",
            shortcut ? "" : "ml-auto"
          )}
        >
          {intentCount}
        </motion.span>
      )}
    </motion.button>
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
