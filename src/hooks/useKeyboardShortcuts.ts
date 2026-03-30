import { useEffect, useCallback } from "react";
import { View } from "@/hooks/useNavigationHistory";

const SHORTCUT_VIEWS: View[] = [
  "dashboard", "analytics", "icp", "companies", "intent",
  "stakeholders", "workflows", "gmaps", "settings",
];

interface UseKeyboardShortcutsOptions {
  onNavigate: (view: View) => void;
  onToggleSidebar: () => void;
}

export function useKeyboardShortcuts({
  onNavigate,
  onToggleSidebar,
}: UseKeyboardShortcutsOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl/Cmd + B → toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      // Alt + 1-9 → navigate to view
      if (e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (idx < SHORTCUT_VIEWS.length) {
          e.preventDefault();
          onNavigate(SHORTCUT_VIEWS[idx]);
        }
      }
    },
    [onNavigate, onToggleSidebar]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
