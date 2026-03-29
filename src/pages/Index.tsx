import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { TopProgressBar } from "@/components/lux/TopProgressBar";
import { Sparkles, Settings, Bell, LayoutDashboard, Target, Workflow, Building2, BarChart3, Search, Radar, Mail, Bot, Menu, X, MapPin, Globe, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/lux/ViewSkeleton";
import { NotificationsPanel, useNotificationCount } from "@/components/lux/NotificationsPanel";
import { AppBreadcrumbs } from "@/components/lux/AppBreadcrumbs";
import { CommandPalette } from "@/components/lux/CommandPalette";
import { OnboardingTour } from "@/components/lux/OnboardingTour";
import { ThemeToggle } from "@/components/lux/ThemeToggle";
import { useNavigationHistory, View } from "@/hooks/useNavigationHistory";
import { AnimatePresence, motion } from "framer-motion";

// Lazy-loaded views for code splitting
const DashboardView = lazy(() => import("@/components/lux/DashboardView").then(m => ({ default: m.DashboardView })));
const ICPConfigView = lazy(() => import("@/components/lux/ICPConfigView").then(m => ({ default: m.ICPConfigView })));
const WorkflowsView = lazy(() => import("@/components/lux/WorkflowsView").then(m => ({ default: m.WorkflowsView })));
const CompaniesView = lazy(() => import("@/components/lux/CompaniesView").then(m => ({ default: m.CompaniesView })));
const IntentSignalsView = lazy(() => import("@/components/lux/IntentSignalsView").then(m => ({ default: m.IntentSignalsView })));
const CampaignsView = lazy(() => import("@/components/lux/CampaignsView").then(m => ({ default: m.CampaignsView })));
const AIAgentView = lazy(() => import("@/components/lux/AIAgentView").then(m => ({ default: m.AIAgentView })));
const AnalyticsView = lazy(() => import("@/components/lux/AnalyticsView").then(m => ({ default: m.AnalyticsView })));
const SettingsView = lazy(() => import("@/components/lux/SettingsView").then(m => ({ default: m.SettingsView })));
const GmapsScraperView = lazy(() => import("@/components/lux/GmapsScraperView").then(m => ({ default: m.GmapsScraperView })));
const CompaniesMapView = lazy(() => import("@/components/lux/CompaniesMapView").then(m => ({ default: m.CompaniesMapView })));
const StakeholderFinderView = lazy(() => import("@/components/lux/StakeholderFinderView").then(m => ({ default: m.StakeholderFinderView })));

const SHORTCUT_VIEWS: View[] = ["dashboard", "analytics", "icp", "companies", "intent", "stakeholders", "workflows", "gmaps", "settings"];

const navItems: { id: View; label: string; icon: React.ReactNode; section?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, section: "Principal" },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "icp", label: "Configurar IPC", icon: <Target className="h-4 w-4" />, section: "Prospecção" },
  { id: "companies", label: "Empresas", icon: <Building2 className="h-4 w-4" /> },
  { id: "intent", label: "Sinais de Intenção", icon: <Radar className="h-4 w-4" /> },
  { id: "stakeholders", label: "Stakeholders", icon: <Users className="h-4 w-4" /> },
  { id: "workflows", label: "Workflows", icon: <Workflow className="h-4 w-4" />, section: "Automação" },
  { id: "gmaps", label: "Google Maps", icon: <MapPin className="h-4 w-4" /> },
  { id: "map", label: "Mapa de Empresas", icon: <Globe className="h-4 w-4" /> },
  { id: "campaigns", label: "Campanhas", icon: <Mail className="h-4 w-4" /> },
  { id: "ai-agent", label: "Agente IA", icon: <Bot className="h-4 w-4" /> },
  { id: "settings", label: "Configurações", icon: <Settings className="h-4 w-4" />, section: "Sistema" },
];

const getShortcut = (id: View): string | null => {
  const idx = SHORTCUT_VIEWS.indexOf(id);
  return idx >= 0 ? `Alt+${idx + 1}` : null;
};

const Index = () => {
  const { activeView, navigate, goBack, canGoBack, breadcrumbs, currentLabel } = useNavigationHistory();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevView = useRef(activeView);
  const unreadCount = useNotificationCount();

  // Mobile swipe gestures
  const onSwipeRight = useCallback(() => setSidebarOpen(true), []);
  const onSwipeLeft = useCallback(() => setSidebarOpen(false), []);
  useSwipeGesture({ onSwipeRight, onSwipeLeft });

  // Track view transitions for progress bar
  useEffect(() => {
    if (activeView !== prevView.current) {
      setIsTransitioning(true);
      prevView.current = activeView;
      const timer = setTimeout(() => setIsTransitioning(false), 350);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  let currentSection = "";

  const handleNav = (id: View) => {
    navigate(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Skip to content for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Pular para o conteúdo
      </a>
      <TopProgressBar isAnimating={isTransitioning} />
      <CommandPalette onNavigate={handleNav} />
      <OnboardingTour />
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        aria-label="Navegação principal"
        role="navigation"
        className={cn(
          "w-64 border-r border-border glass flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                LUX <span className="text-primary glow-text">IA</span>
              </h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Sales Intelligence Platform
              </p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-muted-foreground hover:text-foreground" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const showSection = item.section && item.section !== currentSection;
            if (item.section) currentSection = item.section;
            return (
              <div key={item.id}>
                {showSection && (
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 pt-4 pb-1.5 font-medium">
                    {item.section}
                  </p>
                )}
                {(() => {
                  const shortcut = getShortcut(item.id);
                  const btn = (
                    <button
                      data-tour={item.id}
                      onClick={() => handleNav(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        activeView === item.id
                          ? "bg-primary/10 text-primary glow-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                    >
                      {item.icon}
                      {item.label}
                      {shortcut && (
                        <kbd className="ml-auto text-[9px] font-mono text-muted-foreground hidden lg:inline">{shortcut}</kbd>
                      )}
                      {item.id === "intent" && (
                        <span className={cn("text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-bold", shortcut ? "" : "ml-auto")}>5</span>
                      )}
                    </button>
                  );
                  return shortcut ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.label} <kbd className="ml-1 px-1 py-0.5 rounded bg-muted/50 text-[10px] font-mono border border-border/50">{shortcut}</kbd>
                      </TooltipContent>
                    </Tooltip>
                  ) : btn;
                })()}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Status do Sistema</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Online — 3 workflows ativos</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 lg:ml-64">
        <header className="border-b border-border/50 glass sticky top-0 z-30">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </button>
              <AppBreadcrumbs
                breadcrumbs={breadcrumbs}
                canGoBack={canGoBack}
                onGoBack={goBack}
                onNavigate={handleNav}
                currentLabel={currentLabel}
              />
              <button
                data-tour="search"
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                className="hidden sm:flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-2"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar...</span>
                <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono border border-border/50">⌘K</kbd>
              </button>
            </div>
            <div data-tour="header-actions" className="flex items-center gap-1.5 relative">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
              <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => handleNav("settings")}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary ml-2">
                LX
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="p-4 lg:p-6" aria-label={currentLabel} role="main">
          <Suspense fallback={<ViewSkeleton />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {activeView === "dashboard" && <DashboardView />}
                {activeView === "icp" && <ICPConfigView />}
                {activeView === "workflows" && <WorkflowsView />}
                {activeView === "companies" && <CompaniesView />}
                {activeView === "intent" && <IntentSignalsView />}
                {activeView === "campaigns" && <CampaignsView />}
                {activeView === "ai-agent" && <AIAgentView />}
                {activeView === "analytics" && <AnalyticsView />}
                {activeView === "settings" && <SettingsView />}
                {activeView === "gmaps" && <GmapsScraperView />}
                {activeView === "map" && <CompaniesMapView />}
                {activeView === "stakeholders" && <StakeholderFinderView />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Index;
