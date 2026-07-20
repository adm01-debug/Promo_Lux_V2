import { describe, it, expect } from "vitest";
import { buildCsv } from "../csv";

describe("buildCsv", () => {
  it("prepends a UTF-8 BOM for Excel/PT-BR compatibility", () => {
    const csv = buildCsv(["a"], [["1"]]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("quotes cells containing comma, quote, newline or semicolon", () => {
    const csv = buildCsv(["name"], [["Acme, Inc."], ['Say "hi"'], ["line1\nline2"], ["a;b"]]);
    const lines = csv.replace("﻿", "").split("\n");
    expect(lines[1]).toBe('"Acme, Inc."');
    expect(lines[2]).toBe('"Say ""hi"""');
    // a cell with an embedded newline is itself quoted, but the embedded \n
    // still splits the naive line-by-line split above — assert on the raw
    // csv string instead for that case.
    expect(csv).toContain('"line1\nline2"');
    expect(lines.at(-1)).toBe('"a;b"');
  });

  it("neutralizes formula injection (CSV injection)", () => {
    const csv = buildCsv(["cell"], [["=SUM(A1:A2)"], ["+cmd"], ["@import"], ["-cmd"]]);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'@import");
    expect(csv).toContain("'-cmd");
  });

  it("does not corrupt legitimate negative numbers", () => {
    const csv = buildCsv(["delta"], [[-5], [-12.34]]);
    expect(csv).toContain("-5");
    expect(csv).not.toContain("'-5");
    expect(csv).toContain("-12.34");
    expect(csv).not.toContain("'-12.34");
  });

  it("treats null/undefined as empty cells", () => {
    const csv = buildCsv(["a", "b"], [[null, undefined]]);
    const lines = csv.replace("﻿", "").split("\n");
    expect(lines[1]).toBe(",");
  });
});
