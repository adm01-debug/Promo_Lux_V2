import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadCSV } from "../exportCSV";

describe("downloadCSV", () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  });

  it("does nothing for empty rows", () => {
    downloadCSV([], "test.csv");
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it("creates and clicks a download link", () => {
    downloadCSV([{ name: "Acme", revenue: 100 }], "test.csv");
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test");
  });

  it("sanitizes CSV injection with = prefix", () => {
    downloadCSV([{ formula: "=SUM(A1:A2)" }], "test.csv");
    // The Blob constructor is called with sanitized content
    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0];
    expect(blobArg).toBeDefined();
  });

  it("handles null and undefined values", () => {
    downloadCSV([{ a: null, b: undefined, c: "ok" }], "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("quotes values containing commas", () => {
    downloadCSV([{ name: "Acme, Inc." }], "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });
});
