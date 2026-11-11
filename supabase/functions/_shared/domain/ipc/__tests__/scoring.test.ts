import { describe, it, expect } from "vitest";
import { calculateIPCScore } from "../scoring.ts";

describe("calculateIPCScore", () => {
  it("returns baseline 50 with no criteria and no enrichment signals", () => {
    expect(calculateIPCScore({})).toBe(50);
  });

  it("matches sector case-insensitively (substring)", () => {
    const score = calculateIPCScore(
      { category: "Tecnologia" },
      { sectors: ["tecnologia"] },
    );
    expect(score).toBe(30);
  });

  it("matches sector as a substring, not just exact", () => {
    const score = calculateIPCScore(
      { category: "Desenvolvimento de Software" },
      { sectors: ["software"] },
    );
    expect(score).toBe(30);
  });

  it("falls back from category to type for sector", () => {
    const score = calculateIPCScore(
      { type: "restaurante" },
      { sectors: ["restaurante"] },
    );
    expect(score).toBe(30);
  });

  it("matches location case-insensitively, preferring address over city", () => {
    const score = calculateIPCScore(
      { address: "Av. Paulista, São Paulo", city: "Rio de Janeiro" },
      { locations: ["são paulo"] },
    );
    expect(score).toBe(20);
  });

  it("falls back from address to city for location", () => {
    const score = calculateIPCScore(
      { city: "Curitiba" },
      { locations: ["curitiba"] },
    );
    expect(score).toBe(20);
  });

  it("does not apply the 50-point baseline when criteria is provided but nothing matches", () => {
    const score = calculateIPCScore(
      { category: "Varejo", city: "Manaus" },
      { sectors: ["tecnologia"], locations: ["são paulo"] },
    );
    expect(score).toBe(0);
  });

  it("adds enrichment signals independent of criteria", () => {
    const score = calculateIPCScore({ email: "a@b.com", phone: "119999", website: "https://x.com" });
    // baseline 50 (no criteria) + 15 + 10 + 10
    expect(score).toBe(85);
  });

  it("accepts website via either website or web_site field", () => {
    const withWebsite = calculateIPCScore({ website: "https://x.com" });
    const withWebSite = calculateIPCScore({ web_site: "https://x.com" });
    expect(withWebsite).toBe(withWebSite);
  });

  it("rating >= 4.5 gives +15", () => {
    expect(calculateIPCScore({ rating: 4.5 })).toBe(65); // 50 baseline + 15
    expect(calculateIPCScore({ rating: "4.8" })).toBe(65);
  });

  it("rating >= 4.0 and < 4.5 gives +10", () => {
    expect(calculateIPCScore({ rating: 4.0 })).toBe(60); // 50 baseline + 10
    expect(calculateIPCScore({ rating: 4.2 })).toBe(60);
  });

  it("rating below 4.0 gives no bonus", () => {
    expect(calculateIPCScore({ rating: 3.9 })).toBe(50);
  });

  it("clamps the final score to 100", () => {
    const score = calculateIPCScore(
      { category: "Tecnologia", city: "São Paulo", email: "a@b.com", phone: "1", website: "x.com", rating: 5 },
      { sectors: ["tecnologia"], locations: ["são paulo"] },
    );
    // 30 + 20 + 15 + 10 + 10 + 15 = 100 exactly at the ceiling
    expect(score).toBe(100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("never returns a negative score", () => {
    expect(calculateIPCScore({}, { sectors: [], locations: [] })).toBeGreaterThanOrEqual(0);
  });

  it("handles a malformed numeric rating string gracefully", () => {
    expect(() => calculateIPCScore({ rating: "not-a-number" })).not.toThrow();
    // NaN >= 4.5 is false, NaN >= 4.0 is false — no bonus, just baseline
    expect(calculateIPCScore({ rating: "not-a-number" })).toBe(50);
  });
});
