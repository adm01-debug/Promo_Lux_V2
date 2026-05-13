import type { View } from "@/hooks/useNavigationHistory";
import { AccessibleSkeleton, TableRowSkeleton } from "./skeletons/SkeletonPrimitives";
import { DashboardSkeleton } from "./skeletons/DashboardSkeleton";
import {
  CompaniesSkeleton, AnalyticsSkeleton, FormViewSkeleton, WorkflowsSkeleton,
  MapSkeleton, CampaignsSkeleton, AIAgentSkeleton, IntentSignalsSkeleton,
  StakeholdersSkeleton, GmapsScraperSkeleton, SettingsSkeleton,
} from "./skeletons/ViewSkeletons";

const SKELETON_MAP: Record<View, React.FC> = {
  dashboard: DashboardSkeleton,
  analytics: AnalyticsSkeleton,
  companies: CompaniesSkeleton,
  icp: FormViewSkeleton,
  settings: SettingsSkeleton,
  workflows: WorkflowsSkeleton,
  intent: IntentSignalsSkeleton,
  stakeholders: StakeholdersSkeleton,
  campaigns: CampaignsSkeleton,
  "ai-agent": AIAgentSkeleton,
  gmaps: GmapsScraperSkeleton,
  "scrape-results": GmapsScraperSkeleton,
  map: MapSkeleton,
  organizations: SettingsSkeleton,
  deals: WorkflowsSkeleton,
  integrations: SettingsSkeleton,
  "org-violations": SettingsSkeleton,
  "rls-discovery": SettingsSkeleton,
  monitoring: DashboardSkeleton,
};

/** Render a view-specific skeleton with accessibility. Falls back to DashboardSkeleton. */
export function getViewSkeleton(view: View): React.FC {
  const Skeleton = SKELETON_MAP[view] ?? DashboardSkeleton;
  return function ViewSkeletonWrapper() {
    return (
      <AccessibleSkeleton>
        <Skeleton />
      </AccessibleSkeleton>
    );
  };
}

/** Default generic skeleton (kept for backward compat) */
export const ViewSkeleton = DashboardSkeleton;

export const TableSkeleton = TableRowSkeleton;
