import { StatsGrid } from "@/components/lux/StatsGrid";
import { AutomationsList } from "@/components/lux/AutomationsList";
import { CompanyTable } from "@/components/lux/CompanyTable";
import { ActivityFeed } from "@/components/lux/ActivityFeed";
import { EnrichmentFunnel } from "@/components/lux/EnrichmentFunnel";

export const DashboardView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral das automações e empresas identificadas pelo IPC
        </p>
      </div>

      <StatsGrid />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <EnrichmentFunnel />
        </div>
        <div className="xl:col-span-2">
          <AutomationsList />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <CompanyTable />
        </div>
        <div className="xl:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};
