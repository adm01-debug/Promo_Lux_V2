import { useState } from "react";
import { Sparkles, Settings, Bell, LayoutDashboard, Target, Workflow, Building2, BarChart3, Search, Radar, Mail, Bot, Menu, X, MapPin, Globe, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DashboardView } from "@/components/lux/DashboardView";
import { ICPConfigView } from "@/components/lux/ICPConfigView";
import { WorkflowsView } from "@/components/lux/WorkflowsView";
import { CompaniesView } from "@/components/lux/CompaniesView";
import { IntentSignalsView } from "@/components/lux/IntentSignalsView";
import { CampaignsView } from "@/components/lux/CampaignsView";
import { AIAgentView } from "@/components/lux/AIAgentView";
import { AnalyticsView } from "@/components/lux/AnalyticsView";
import { SettingsView } from "@/components/lux/SettingsView";
import { GmapsScraperView } from "@/components/lux/GmapsScraperView";
import { CompaniesMapView } from "@/components/lux/CompaniesMapView";
import { NotificationsPanel, useNotificationCount } from "@/components/lux/NotificationsPanel";
import { StakeholderFinderView } from "@/components/lux/StakeholderFinderView";
import { AnimatePresence, motion } from "framer-motion";

type View = "dashboard" | "icp" | "workflows" | "companies" | "intent" | "campaigns" | "ai-agent" | "analytics" | "settings" | "gmaps" | "map" | "stakeholders";

const navItems: { id: View; label: string; icon: React.ReactNode; section?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, section: "Principal" },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "icp", label: "Configurar IPC", icon: <Target className="h-4 w-4" />, section: "Prospecção" },
  { id: "companies", label: "Empresas", icon: <Building2 className="h-4 w-4" /> },
  { id: "intent", label: "Sinais de Intenção", icon: <Radar className="h-4 w-4" /> },
  { id: "workflows", label: "Workflows", icon: <Workflow className="h-4 w-4" />, section: "Automação" },
  { id: "gmaps", label: "Google Maps", icon: <MapPin className="h-4 w-4" /> },
  { id: "map", label: "Mapa de Empresas", icon: <Globe className="h-4 w-4" /> },
  { id: "campaigns", label: "Campanhas", icon: <Mail className="h-4 w-4" /> },
  { id: "ai-agent", label: "Agente IA", icon: <Bot className="h-4 w-4" /> },
  { id: "settings", label: "Configurações", icon: <Settings className="h-4 w-4" />, section: "Sistema" },
];

const Index = () => {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = useNotificationCount();

  let currentSection = "";

  const handleNav = (id: View) => {
    setActiveView(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "w-64 border-r border-border/50 glass flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 border-b border-border/50">
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
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-muted-foreground hover:text-foreground">
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
                <button
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
                  {item.id === "intent" && (
                    <span className="ml-auto text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-bold">5</span>
                  )}
                </button>
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
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <Search className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Input
                  placeholder="Buscar empresas, automações, sinais..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 placeholder:text-muted-foreground/50 hidden sm:block"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
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

        <main className="p-4 lg:p-6">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
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
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Index;
