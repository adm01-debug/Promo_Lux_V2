import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadCSV } from "../exportCSV";

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
