import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export type View = "dashboard" | "icp" | "workflows" | "companies" | "intent" | "campaigns" | "ai-agent" | "analytics" | "settings" | "gmaps" | "map" | "stakeholders";

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  icp: "Configurar IPC",
  companies: "Empresas",
  intent: "Sinais de Intenção",
  stakeholders: "Stakeholders",
  workflows: "Workflows",
  gmaps: "Google Maps",
  map: "Mapa de Empresas",
  campaigns: "Campanhas",
  "ai-agent": "Agente IA",
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
  map: "Automação",
  campaigns: "Automação",
  "ai-agent": "Automação",
  settings: "Sistema",
};

const ALL_VIEWS: View[] = ["dashboard", "icp", "workflows", "companies", "intent", "campaigns", "ai-agent", "analytics", "settings", "gmaps", "map", "stakeholders"];

// Alt+1..9 shortcuts map to top nav items
const SHORTCUT_VIEWS: View[] = ["dashboard", "analytics", "icp", "companies", "intent", "stakeholders", "workflows", "gmaps", "settings"];

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

  // Sync URL when view changes
  useEffect(() => {
    const current = searchParams.get("view");
    if (activeView === "dashboard" && !current) return;
    if (current !== activeView) {
      setSearchParams(activeView === "dashboard" ? {} : { view: activeView }, { replace: true });
    }
  }, [activeView]);

  const navigate = useCallback((view: View) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(view);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    setActiveView(view);
  }, [historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
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
  };
}
