import { lazy } from "react";
import type { View } from "@/hooks/useNavigationHistory";

/**
 * Prefetch-capable view registry.
 * Each entry stores both the lazy component and the raw import function for prefetching.
 */

const viewImports: Record<View, () => Promise<unknown>> = {
  dashboard: () => import("@/components/lux/DashboardView"),
  icp: () => import("@/components/lux/ICPConfigView"),
  workflows: () => import("@/components/lux/WorkflowsView"),
  companies: () => import("@/components/lux/CompaniesView"),
  intent: () => import("@/components/lux/IntentSignalsView"),
  campaigns: () => import("@/components/lux/CampaignsView"),
  "ai-agent": () => import("@/components/lux/AIAgentView"),
  analytics: () => import("@/components/lux/AnalyticsView"),
  settings: () => import("@/components/lux/SettingsView"),
  gmaps: () => import("@/components/lux/GmapsScraperView"),
  "scrape-results": () => import("@/components/lux/ScrapeResultsView"),
  map: () => import("@/components/lux/CompaniesMapView"),
  stakeholders: () => import("@/components/lux/StakeholderFinderView"),
  organizations: () => import("@/components/lux/OrganizationsView"),
  deals: () => import("@/components/lux/DealsView"),
  integrations: () => import("@/components/lux/IntegrationsView"),
  "org-violations": () => import("@/components/lux/OrgViolationsView"),
  "rls-discovery": () => import("@/components/lux/settings/RLSDiscoveryView"),
  ponto: () => import("@/components/lux/PontoView"),
};

// Cache to avoid double-prefetch
const prefetched = new Set<View>();

/** Prefetch a view's chunk without rendering it */
export function prefetchView(view: View) {
  if (prefetched.has(view)) return;
  prefetched.add(view);
  viewImports[view]?.();
}

/** Lazy components for React.Suspense rendering */
export const VIEW_MAP: Record<View, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: lazy(() => import("@/components/lux/DashboardView").then(m => ({ default: m.DashboardView }))),
  icp: lazy(() => import("@/components/lux/ICPConfigView").then(m => ({ default: m.ICPConfigView }))),
  workflows: lazy(() => import("@/components/lux/WorkflowsView").then(m => ({ default: m.WorkflowsView }))),
  companies: lazy(() => import("@/components/lux/CompaniesView").then(m => ({ default: m.CompaniesView }))),
  intent: lazy(() => import("@/components/lux/IntentSignalsView").then(m => ({ default: m.IntentSignalsView }))),
  campaigns: lazy(() => import("@/components/lux/CampaignsView").then(m => ({ default: m.CampaignsView }))),
  "ai-agent": lazy(() => import("@/components/lux/AIAgentView").then(m => ({ default: m.AIAgentView }))),
  analytics: lazy(() => import("@/components/lux/AnalyticsView").then(m => ({ default: m.AnalyticsView }))),
  settings: lazy(() => import("@/components/lux/SettingsView").then(m => ({ default: m.SettingsView }))),
  gmaps: lazy(() => import("@/components/lux/GmapsScraperView").then(m => ({ default: m.GmapsScraperView }))),
  "scrape-results": lazy(() => import("@/components/lux/ScrapeResultsView").then(m => ({ default: m.ScrapeResultsView }))),
  map: lazy(() => import("@/components/lux/CompaniesMapView").then(m => ({ default: m.CompaniesMapView }))),
  stakeholders: lazy(() => import("@/components/lux/StakeholderFinderView").then(m => ({ default: m.StakeholderFinderView }))),
  organizations: lazy(() => import("@/components/lux/OrganizationsView").then(m => ({ default: m.OrganizationsView }))),
  deals: lazy(() => import("@/components/lux/DealsView").then(m => ({ default: m.DealsView }))),
  integrations: lazy(() => import("@/components/lux/IntegrationsView").then(m => ({ default: m.IntegrationsView }))),
  "org-violations": lazy(() => import("@/components/lux/OrgViolationsView").then(m => ({ default: m.OrgViolationsView }))),
  "rls-discovery": lazy(() => import("@/components/lux/settings/RLSDiscoveryView").then(m => ({ default: m.RLSDiscoveryView }))),
  ponto: lazy(() => import("@/components/lux/PontoView").then(m => ({ default: m.PontoView }))),
};
