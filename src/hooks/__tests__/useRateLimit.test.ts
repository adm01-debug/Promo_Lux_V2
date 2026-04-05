import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRateLimit } from "../useRateLimit";

describe("useRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unlocked", () => {
    const { result } = renderHook(() => useRateLimit());
    expect(result.current.isLocked().locked).toBe(false);
  });

  it("stays unlocked under max attempts", () => {
    const { result } = renderHook(() =>
      useRateLimit({ maxAttempts: 3, windowMs: 60000, lockoutMs: 5000 })
    );

    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });
    expect(result.current.isLocked().locked).toBe(false);
  });

  it("locks after reaching max attempts", () => {
    const { result } = renderHook(() =>
      useRateLimit({ maxAttempts: 3, windowMs: 60000, lockoutMs: 5000 })
    );

    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });
    const lockResult = act(() => result.current.recordAttempt());
    expect(result.current.isLocked().locked).toBe(true);
  });

  it("unlocks after lockout period", () => {
    const { result } = renderHook(() =>
      useRateLimit({ maxAttempts: 2, windowMs: 60000, lockoutMs: 5000 })
    );

    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });
    expect(result.current.isLocked().locked).toBe(true);

    act(() => { vi.advanceTimersByTime(5001); });
    expect(result.current.isLocked().locked).toBe(false);
  });

  it("checkAndRecord returns lock status when already locked", () => {
    const { result } = renderHook(() =>
      useRateLimit({ maxAttempts: 2, windowMs: 60000, lockoutMs: 5000 })
    );

    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });

    let status: { locked: boolean; remainingSec: number } = { locked: false, remainingSec: 0 };
    act(() => { status = result.current.checkAndRecord(); });
    expect(status.locked).toBe(true);
    expect(status.remainingSec).toBeGreaterThan(0);
  });

  it("clears old attempts outside the window", () => {
    const { result } = renderHook(() =>
      useRateLimit({ maxAttempts: 3, windowMs: 1000, lockoutMs: 5000 })
    );

    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });

    // Advance past the window
    act(() => { vi.advanceTimersByTime(1500); });

    // These should not trigger lockout because old attempts expired
    act(() => { result.current.recordAttempt(); });
    act(() => { result.current.recordAttempt(); });
    expect(result.current.isLocked().locked).toBe(false);
  });
});
