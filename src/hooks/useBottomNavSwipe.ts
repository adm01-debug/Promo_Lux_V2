import { useCallback } from "react";
import { View } from "@/hooks/useNavigationHistory";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

/** The ordered tabs shown in mobile bottom nav */
const TAB_ORDER: View[] = ["dashboard", "companies", "analytics", "ai-agent"];

export function useBottomNavSwipe(
  activeView: View,
  onNavigate: (view: View) => void,
) {
  const currentIdx = TAB_ORDER.indexOf(activeView);

  const goNext = useCallback(() => {
    const idx = TAB_ORDER.indexOf(activeView);
    if (idx >= 0 && idx < TAB_ORDER.length - 1) {
      onNavigate(TAB_ORDER[idx + 1]);
    }
  }, [activeView, onNavigate]);

  const goPrev = useCallback(() => {
    const idx = TAB_ORDER.indexOf(activeView);
    if (idx > 0) {
      onNavigate(TAB_ORDER[idx - 1]);
    }
  }, [activeView, onNavigate]);

  // Only enable tab swiping when the current view is one of the bottom nav tabs
  const isBottomNavView = currentIdx >= 0;

  useSwipeGesture({
    onSwipeLeft: isBottomNavView ? goNext : undefined,
    onSwipeRight: isBottomNavView ? goPrev : undefined,
    threshold: 60,
    anywhere: true,
  });

  return { currentTabIndex: currentIdx, tabCount: TAB_ORDER.length };
}
