import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn (class merge utility)", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("px-4", "px-8")).toBe("px-8");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("merges arrays", () => {
    expect(cn(["px-4", "py-2"])).toBe("px-4 py-2");
  });
});
