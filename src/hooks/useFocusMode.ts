import { useState, useEffect, useCallback } from "react";

const FOCUS_MODE_KEY = "lux-focus-mode";

export function useFocusMode() {
  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(FOCUS_MODE_KEY) === "true";
    }
    return false;
  });

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      localStorage.setItem(FOCUS_MODE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + F → toggle focus mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFocusMode]);

  return { focusMode, toggleFocusMode };
}
