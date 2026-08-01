import { useState, useCallback } from "react";

const SIDEBAR_COLLAPSED_KEY = "lux-sidebar-collapsed";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    }
    return false;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return {
    collapsed,
    mobileOpen,
    toggleCollapse,
    openMobile,
    closeMobile,
  };
}
