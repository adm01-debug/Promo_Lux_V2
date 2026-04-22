import { useState, useCallback, useEffect, useRef } from "react";
import { prefetchView } from "@/lib/viewRegistry";
import { useSearchParams } from "react-router-dom";

export type View = "dashboard" | "icp" | "workflows" | "companies" | "intent" | "campaigns" | "ai-agent" | "analytics" | "settings" | "gmaps" | "map" | "stakeholders" | "scrape-results" | "organizations" | "audit";

export type NavigationDirection = "forward" | "back";

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  icp: "Configurar IPC",
  companies: "Empresas",
  intent: "Sinais de Intenção",
  stakeholders: "Stakeholders",
  workflows: "Workflows",
  gmaps: "Google Maps",
  "scrape-results": "Resultados de Raspagem",
  map: "Mapa de Empresas",
  campaigns: "Campanhas",
  "ai-agent": "Agente IA",
  organizations: "Workspaces",
  audit: "Audit Log",
  settings: "Configurações",
};

const VIEW_SECTIONS: Record<View, string> = {
  dashboard: "Principal",
  analytics: "Principal",
  icp: "Prospecção",
  companies: "Prospecção",
  intent: "Prospecção",
  stakeholders: "Prospecção",
  workflows: "Automação",
  gmaps: "Automação",
  "scrape-results": "Automação",
  map: "Automação",
  campaigns: "Automação",
  "ai-agent": "Automação",
  organizations: "Sistema",
  audit: "Sistema",
  settings: "Sistema",
};

const ALL_VIEWS: View[] = ["dashboard", "icp", "workflows", "companies", "intent", "campaigns", "ai-agent", "analytics", "settings", "gmaps", "map", "stakeholders", "scrape-results", "organizations", "audit"];

// Shortcut views moved to useKeyboardShortcuts

function isValidView(v: string | null): v is View {
  return !!v && ALL_VIEWS.includes(v as View);
}

export function useNavigationHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramView = searchParams.get("view");
  const initialView: View = isValidView(paramView) ? paramView : "dashboard";

  const [activeView, setActiveView] = useState<View>(initialView);
  const [history, setHistory] = useState<View[]>([initialView]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [direction, setDirection] = useState<NavigationDirection>("forward");
  const isPopState = useRef(false);

  // Sync URL → state on popstate (browser back/forward)
  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const view = url.searchParams.get("view");
      if (isValidView(view) && view !== activeView) {
        isPopState.current = true;
        setDirection("back");
        setActiveView(view);
      } else if (!view && activeView !== "dashboard") {
        isPopState.current = true;
        setDirection("back");
        setActiveView("dashboard");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeView]);

  // Sync state → URL (push, not replace, for browser history)
  useEffect(() => {
    if (isPopState.current) {
      isPopState.current = false;
      return;
    }
    const current = searchParams.get("view");
    const target = activeView === "dashboard" ? null : activeView;
    if (current !== target) {
      const params: Record<string, string> = target ? { view: target } : {};
      setSearchParams(params, { replace: false });
    }
  }, [activeView]);

  const navigate = useCallback((view: View) => {
    setDirection("forward");
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(view);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Prefetch adjacent views for instant navigation
    const idx = ALL_VIEWS.indexOf(view);
    if (idx > 0) prefetchView(ALL_VIEWS[idx - 1]);
    if (idx < ALL_VIEWS.length - 1) prefetchView(ALL_VIEWS[idx + 1]);
  }, [historyIndex]);

  // Alt+N shortcuts moved to useKeyboardShortcuts hook

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      setDirection("back");
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setActiveView(history[newIndex]);
    }
  }, [history, historyIndex]);

  const canGoBack = historyIndex > 0;

  const breadcrumbs = [
    { label: "LUX IA", view: "dashboard" as View },
    ...(activeView !== "dashboard"
      ? [
          { label: VIEW_SECTIONS[activeView], view: undefined },
          { label: VIEW_LABELS[activeView], view: activeView },
        ]
      : []),
  ];

  return {
    activeView,
    navigate,
    goBack,
    canGoBack,
    breadcrumbs,
    currentLabel: VIEW_LABELS[activeView],
    currentSection: VIEW_SECTIONS[activeView],
    direction,
  };
}
