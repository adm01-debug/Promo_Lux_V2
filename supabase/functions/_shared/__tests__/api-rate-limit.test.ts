import { describe, it, expect } from "vitest";
import { parseRateLimitDecision, retryAfterSeconds } from "../api-rate-limit.ts";

describe("parseRateLimitDecision", () => {
  it("aprova quando a RPC devolve allowed=true", () => {
    expect(parseRateLimitDecision([{ allowed: true, current_count: 3, reset_at: "2026-11-21T13:00:00Z" }]))
      .toEqual({ allowed: true, currentCount: 3, resetAt: "2026-11-21T13:00:00Z" });
  });

  it("bloqueia quando a RPC devolve allowed=false", () => {
    expect(parseRateLimitDecision([{ allowed: false, current_count: 600, reset_at: "2026-11-21T13:00:00Z" }]).allowed)
      .toBe(false);
  });

  it("fail-open em resposta vazia/nula", () => {
    expect(parseRateLimitDecision(null)).toEqual({ allowed: true, currentCount: null, resetAt: null });
    expect(parseRateLimitDecision([])).toEqual({ allowed: true, currentCount: null, resetAt: null });
    expect(parseRateLimitDecision("boom")).toEqual({ allowed: true, currentCount: null, resetAt: null });
  });

  it("trata objeto ?nico e array de uma linha da mesma forma", () => {
    const obj = { allowed: true, current_count: 1, reset_at: "x" };
    expect(parseRateLimitDecision(obj)).toEqual(parseRateLimitDecision([obj]));
  });
});

describe("retryAfterSeconds", () => {
  it("usa resetAt futuro e nunca devolve 0", () => {
    const later = new Date(Date.now() + 90_000).toISOString();
    expect(Number(retryAfterSeconds(later))).toBeGreaterThan(0);
  });

  it("fallback de 1h sem reset_at", () => {
    expect(retryAfterSeconds(null)).toBe("3600");
  });
});
