import { useEffect, useCallback } from "react";
import { View } from "@/hooks/useNavigationHistory";
import { toast } from "sonner";

const SHORTCUT_VIEWS: View[] = [
  "dashboard", "analytics", "icp", "companies", "intent",
  "stakeholders", "workflows", "gmaps", "settings",
];

interface UseKeyboardShortcutsOptions {
  onNavigate: (view: View) => void;
  onToggleSidebar: () => void;
  onBack?: () => void;
}

export function useKeyboardShortcuts({
  onNavigate,
  onToggleSidebar,
  onBack,
}: UseKeyboardShortcutsOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      
      // Ctrl/Cmd + B → toggle sidebar (always allow)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      if (isInput) return;

      // Escape → go back
      if (e.key === "Escape" && onBack) {
        // Only if not in a modal or menu (those handle Esc themselves)
        const hasOverlay = document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]');
        
        if (!hasOverlay) {
          e.preventDefault();
          onBack();
          return;
        }
      }

      // Alt + D → dashboard
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onNavigate("dashboard");
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

      // Shortcut help
      if (e.key === "?" || e.key === "/") {
        // Handled globally by the dialog trigger usually, but we can ensure it's captured
      }
    },
    [onNavigate, onToggleSidebar, onBack]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
