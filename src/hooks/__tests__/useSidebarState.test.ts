import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarState } from "@/hooks/useSidebarState";

describe("useSidebarState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts expanded by default", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.mobileOpen).toBe(false);
  });

  it("toggles collapse state", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.toggleCollapse());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggleCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("persists collapsed state to localStorage", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.toggleCollapse());
    expect(localStorage.getItem("lux-sidebar-collapsed")).toBe("true");
  });

  it("loads collapsed state from localStorage", () => {
    localStorage.setItem("lux-sidebar-collapsed", "true");
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.collapsed).toBe(true);
  });

  it("controls mobile open/close", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.openMobile());
    expect(result.current.mobileOpen).toBe(true);
    act(() => result.current.closeMobile());
    expect(result.current.mobileOpen).toBe(false);
  });
});
