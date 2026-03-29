import { Sparkles, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/lux/StatsGrid";
import { AutomationsList } from "@/components/lux/AutomationsList";
import { CompanyTable } from "@/components/lux/CompanyTable";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                LUX <span className="text-primary glow-text">IA</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground -mt-0.5">
                Automação & Prospecção
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-4.5 w-4.5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das automações e empresas identificadas pelo IPC
          </p>
        </div>

        <StatsGrid />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2">
            <AutomationsList />
          </div>
          <div className="xl:col-span-3">
            <CompanyTable />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
