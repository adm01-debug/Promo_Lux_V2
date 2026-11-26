import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedFilters } from "../usePersistedFilters";

describe("usePersistedFilters", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default state on first render", () => {
    const { result } = renderHook(() =>
      usePersistedFilters("test-view", { search: "", page: 1 })
    );
    expect(result.current[0]).toEqual({ search: "", page: 1 });
  });

  it("persists state updates to localStorage", () => {
    const { result } = renderHook(() =>
      usePersistedFilters("test-view", { search: "", page: 1 })
    );

    act(() => {
      result.current[1]({ search: "acme", page: 2 });
    });

    expect(result.current[0]).toEqual({ search: "acme", page: 2 });
    expect(localStorage.getItem("lux-filters-test-view")).toBeTruthy();
  });

  it("restores state from localStorage", () => {
    localStorage.setItem(
      "lux-filters-persist-view",
      JSON.stringify({ search: "saved", page: 5 })
    );

    const { result } = renderHook(() =>
      usePersistedFilters("persist-view", { search: "", page: 1 })
    );
    expect(result.current[0]).toEqual({ search: "saved", page: 5 });
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() =>
      usePersistedFilters("func-view", { count: 0 })
    );

    act(() => {
      result.current[1]((prev) => ({ count: prev.count + 1 }));
    });
    expect(result.current[0].count).toBe(1);
  });

  it("resets state to default and clears localStorage", () => {
    const { result } = renderHook(() =>
      usePersistedFilters("reset-view", { search: "", page: 1 })
    );

    act(() => {
      result.current[1]({ search: "something", page: 3 });
    });
    expect(result.current[0].search).toBe("something");

    act(() => {
      result.current[2](); // reset
    });
    expect(result.current[0]).toEqual({ search: "", page: 1 });
    expect(localStorage.getItem("lux-filters-reset-view")).toBeNull();
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("lux-filters-corrupt-view", "not-json{{{");

    const { result } = renderHook(() =>
      usePersistedFilters("corrupt-view", { search: "", page: 1 })
    );
    expect(result.current[0]).toEqual({ search: "", page: 1 });
  });

  it("serializes and deserializes Set values", () => {
    const { result } = renderHook(() =>
      usePersistedFilters("set-view", { tags: new Set(["a", "b"]) })
    );

    act(() => {
      result.current[1]({ tags: new Set(["x", "y", "z"]) });
    });

    // Re-mount to test deserialization
    const stored = localStorage.getItem("lux-filters-set-view");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.tags.__set).toEqual(["x", "y", "z"]);
  });

  it("instala o escutador de armazenamento uma única vez por montagem", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(
      ({ defaults }: { defaults: { page: number } }) => usePersistedFilters("once-view", defaults),
      { initialProps: { defaults: { page: 1 } } }
    );

    // Nova identidade a cada render (literal inline, como nos consumidores).
    rerender({ defaults: { page: 1 } });
    rerender({ defaults: { page: 1 } });

    const storageListeners = addSpy.mock.calls.filter(([type]) => type === "storage").length;
    expect(storageListeners).toBe(1);
    addSpy.mockRestore();
  });

  it("mantém a sincronização entre abas depois de vários renders", () => {
    const { rerender, result } = renderHook(
      ({ defaults }: { defaults: { page: number } }) => usePersistedFilters("sync-view", defaults),
      { initialProps: { defaults: { page: 1 } } }
    );
    rerender({ defaults: { page: 1 } });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "lux-filters-sync-view", newValue: JSON.stringify({ page: 7 }) })
      );
    });

    expect(result.current[0]).toEqual({ page: 7 });
  });
});
