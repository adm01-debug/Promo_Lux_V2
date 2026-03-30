import { useCallback, useState } from "react";
import { View } from "@/hooks/useNavigationHistory";

const STORAGE_KEY = "lux-recent-views";
const MAX_RECENT = 5;

export interface RecentView {
  id: View;
  timestamp: number;
}

function loadRecent(): RecentView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useRecentViews() {
  const [recentViews, setRecentViews] = useState<RecentView[]>(loadRecent);

  const trackView = useCallback((view: View) => {
    setRecentViews((prev) => {
      const filtered = prev.filter((r) => r.id !== view);
      const next = [{ id: view, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentViews, trackView };
}
