import { describe, it, expect } from "vitest";
import { calculateIpcScore } from "../lib/ipc";

describe("calculateIpcScore", () => {
  const criteria = {
    sectors: ["Tecnologia", "SaaS"],
    locations: ["São Paulo", "SP"],
  };

  it("calculates basic score without criteria", () => {
    const result = { email: "test@test.com" };
    // 50 base + 15 email = 65
    expect(calculateIpcScore(result)).toBe(65);
  });

  it("calculates full score with criteria matches", () => {
    const result = {
      category: "Tecnologia",
      city: "São Paulo, SP",
      email: "test@test.com",
      phone: "1199999999",
      website: "test.com",
      rating: 4.5
    };
    // 30 (sector) + 20 (location) + 15 (email) + 10 (phone) + 10 (web) + 15 (rating) = 100
    expect(calculateIpcScore(result, criteria)).toBe(100);
  });

  it("caps score at 100", () => {
    const result = {
      category: "Tecnologia",
      city: "São Paulo, SP",
      email: "test@test.com",
      phone: "1199999999",
      website: "test.com",
      rating: 5.0
    };
    expect(calculateIpcScore(result, criteria)).toBe(100);
  });

  it("handles missing data gracefully", () => {
    expect(calculateIpcScore({}, criteria)).toBe(0);
  });
});
