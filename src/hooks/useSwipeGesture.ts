import { useEffect, useRef } from "react";

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  edgeSize?: number;
  /** If true, swipe triggers anywhere (not just from edge) */
  anywhere?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  edgeSize = 30,
  anywhere = false,
}: UseSwipeGestureOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchStartedAtEdge = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      touchStartedAtEdge.current = touch.clientX <= edgeSize;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = Math.abs(touch.clientY - touchStart.current.y);

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) > threshold && deltaY < Math.abs(deltaX) * 0.7) {
        if (deltaX > 0 && (anywhere || touchStartedAtEdge.current)) {
          onSwipeRight?.();
        } else if (deltaX < 0 && (anywhere || true)) {
          onSwipeLeft?.();
        }
      }
      touchStart.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, edgeSize, anywhere]);
}
