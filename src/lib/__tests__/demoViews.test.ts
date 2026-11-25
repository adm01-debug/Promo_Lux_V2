import { describe, it, expect } from "vitest";
import { shouldShowDemoNotice, DEMO_UNSUPPORTED_VIEWS } from "../demoViews";
import { VIEW_MAP } from "../viewRegistry";

describe("shouldShowDemoNotice", () => {
  it("avisa nas views sem dados de exemplo quando a demonstração está ativa", () => {
    expect(shouldShowDemoNotice("analytics", true)).toBe(true);
    expect(shouldShowDemoNotice("settings", true)).toBe(true);
    expect(shouldShowDemoNotice("lusha", true)).toBe(true);
  });

  it("não avisa nas views que têm dados de exemplo", () => {
    for (const view of ["dashboard", "workflows", "companies", "intent", "campaigns", "stakeholders"] as const) {
      expect(shouldShowDemoNotice(view, true)).toBe(false);
    }
  });

  it("não avisa fora da demonstração", () => {
    expect(shouldShowDemoNotice("analytics", false)).toBe(false);
    expect(shouldShowDemoNotice("dashboard", false)).toBe(false);
  });

  it("cobre todas as views registradas: cada uma tem demonstração ou aviso", () => {
    const comDemo = ["dashboard", "workflows", "companies", "intent", "campaigns", "stakeholders"];
    for (const view of Object.keys(VIEW_MAP)) {
      const coberta = comDemo.includes(view) || DEMO_UNSUPPORTED_VIEWS.includes(view as never);
      expect(coberta, `view sem cobertura de demonstração: ${view}`).toBe(true);
    }
  });
});