import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRateLimit } from "../useRateLimit";

describe("useRateLimit", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("should not be locked initially", () => {
    const { result } = renderHook(() => useRateLimit("test", { maxAttempts: 2, windowMs: 1000 }));
    expect(result.current.locked).toBe(false);
  });

  it("should lock after exceeding max attempts", () => {
    const { result } = renderHook(() => useRateLimit("test", { maxAttempts: 2, windowMs: 1000 }));

    act(() => {
      result.current.recordAttempt();
    });
    expect(result.current.locked).toBe(false);

    act(() => {
      result.current.recordAttempt();
    });
    expect(result.current.locked).toBe(true);
    expect(result.current.remainingSec).toBe(1);
  });

  it("should unlock after window windowMs", () => {
    const { result } = renderHook(() => useRateLimit("test", { maxAttempts: 1, windowMs: 1000 }));

    act(() => {
      result.current.recordAttempt();
    });
    expect(result.current.locked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    
    // Manual check because interval runs every 1s
    expect(result.current.isLocked().locked).toBe(false);
  });
});
