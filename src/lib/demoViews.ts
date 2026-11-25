import type { View } from "@/hooks/useNavigationHistory";

/**
 * Views que não têm dados de exemplo. Na demonstração elas mostram um aviso
 * explicativo em vez de uma tela vazia (ver `DemoNotice`).
 *
 * As views com demonstração são: dashboard, workflows, companies, intent,
 * campaigns e stakeholders. Toda view nova entra nesta lista até receber
 * dados de exemplo próprios.
 */
export const DEMO_UNSUPPORTED_VIEWS: readonly View[] = [
  "icp",
  "ai-agent",
  "analytics",
  "settings",
  "gmaps",
  "scrape-results",
  "map",
  "organizations",
  "deals",
  "integrations",
  "org-violations",
  "rls-discovery",
  "monitoring",
  "automations",
  "recycle-bin",
  "suppressions",
  "lusha",
];

/** A view deve trocar o conteúdo pelo aviso de demonstração? */
export const shouldShowDemoNotice = (view: View, isDemoMode: boolean): boolean =>
  isDemoMode && DEMO_UNSUPPORTED_VIEWS.includes(view);