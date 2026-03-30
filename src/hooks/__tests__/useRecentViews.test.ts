import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentViews } from "@/hooks/useRecentViews";

describe("useRecentViews", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with empty recent views", () => {
    const { result } = renderHook(() => useRecentViews());
    expect(result.current.recentViews).toEqual([]);
  });

  it("tracks a viewed page", () => {
    const { result } = renderHook(() => useRecentViews());
    act(() => result.current.trackView("dashboard"));
    expect(result.current.recentViews).toHaveLength(1);
    expect(result.current.recentViews[0].id).toBe("dashboard");
  });

  it("deduplicates on revisit and moves to front", () => {
    const { result } = renderHook(() => useRecentViews());
    act(() => {
      result.current.trackView("dashboard");
      result.current.trackView("companies");
      result.current.trackView("dashboard");
    });
    expect(result.current.recentViews).toHaveLength(2);
    expect(result.current.recentViews[0].id).toBe("dashboard");
    expect(result.current.recentViews[1].id).toBe("companies");
  });

  it("limits to 5 recent views", () => {
    const { result } = renderHook(() => useRecentViews());
    act(() => {
      result.current.trackView("dashboard");
      result.current.trackView("companies");
      result.current.trackView("workflows");
      result.current.trackView("analytics");
      result.current.trackView("icp");
      result.current.trackView("settings");
    });
    expect(result.current.recentViews).toHaveLength(5);
    expect(result.current.recentViews[0].id).toBe("settings");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useRecentViews());
    act(() => result.current.trackView("analytics"));
    const stored = JSON.parse(localStorage.getItem("lux-recent-views") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("analytics");
  });

  it("loads from localStorage on mount", () => {
    localStorage.setItem(
      "lux-recent-views",
      JSON.stringify([{ id: "workflows", timestamp: Date.now() }])
    );
    const { result } = renderHook(() => useRecentViews());
    expect(result.current.recentViews).toHaveLength(1);
    expect(result.current.recentViews[0].id).toBe("workflows");
  });
});
