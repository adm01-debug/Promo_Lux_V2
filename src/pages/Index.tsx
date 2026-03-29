import { useState } from "react";
import { Sparkles, Settings, Bell, LayoutDashboard, Target, Workflow, Building2, BarChart3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DashboardView } from "@/components/lux/DashboardView";
import { ICPConfigView } from "@/components/lux/ICPConfigView";
import { WorkflowsView } from "@/components/lux/WorkflowsView";
import { CompaniesView } from "@/components/lux/CompaniesView";

type View = "dashboard" | "icp" | "workflows" | "companies";

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "icp", label: "Configurar IPC", icon: <Target className="h-4 w-4" /> },
  { id: "workflows", label: "Workflows", icon: <Workflow className="h-4 w-4" /> },
  { id: "companies", label: "Empresas", icon: <Building2 className="h-4 w-4" /> },
];

const Index = () => {
  const [activeView, setActiveView] = useState<View>("dashboard");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 glass flex flex-col fixed inset-y-0 left-0 z-50">
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
                Automação & Prospecção
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeView === item.id
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Status do Sistema</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Online — 3 automações ativas</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 ml-64">
        {/* Top bar */}
        <header className="border-b border-border/50 glass sticky top-0 z-40">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresas, automações..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary ml-2">
                LX
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {activeView === "dashboard" && <DashboardView />}
          {activeView === "icp" && <ICPConfigView />}
          {activeView === "workflows" && <WorkflowsView />}
          {activeView === "companies" && <CompaniesView />}
        </main>
      </div>
    </div>
  );
};

export default Index;
