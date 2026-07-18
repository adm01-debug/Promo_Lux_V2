import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadCSV, sanitizeCell } from "../exportCSV";

describe("sanitizeCell", () => {
  it("prefixes formula injection with a quote", () => {
    expect(sanitizeCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCell("@import")).toBe("'@import");
    expect(sanitizeCell("\tsneaky")).toBe("'\tsneaky");
  });

  it("does not corrupt legitimate negative numbers", () => {
    expect(sanitizeCell(-5)).toBe("-5");
    expect(sanitizeCell("-5")).toBe("-5");
    expect(sanitizeCell(-12.34)).toBe("-12.34");
    expect(sanitizeCell("-0")).toBe("-0");
  });

  it("still blocks a non-numeric string that merely starts with -", () => {
    // "-cmd" is not a valid number, so it's still a plausible formula/command
    // injection vector and must be neutralized.
    expect(sanitizeCell("-cmd")).toBe("'-cmd");
  });

  it("passes through safe strings unchanged", () => {
    expect(sanitizeCell("Acme Inc.")).toBe("Acme Inc.");
    expect(sanitizeCell(42)).toBe("42");
  });

  it("handles null/undefined as empty string", () => {
    expect(sanitizeCell(null)).toBe("");
    expect(sanitizeCell(undefined)).toBe("");
  });
});

describe("downloadCSV", () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    // jsdom doesn't have URL.createObjectURL — define it
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("does nothing for empty rows", () => {
    downloadCSV([], "test.csv");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("creates and clicks a download link", () => {
    downloadCSV([{ name: "Acme", revenue: 100 }], "test.csv");
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("handles null and undefined values", () => {
    downloadCSV([{ a: null, b: undefined, c: "ok" }], "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("quotes values containing commas", () => {
    downloadCSV([{ name: "Acme, Inc." }], "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles CSV injection prefixes", () => {
    downloadCSV([{ formula: "=SUM(A1:A2)", cmd: "+cmd" }], "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });
});
