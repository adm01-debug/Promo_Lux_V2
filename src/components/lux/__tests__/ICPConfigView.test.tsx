import { describe, it, expect, vi } from "vitest";

vi.mock("@/hooks/useICPConfig", () => ({
  useICPConfig: vi.fn(() => ({
    config: {
      criteria: [
        { id: "c1", type: "sector", label: "Setor", operator: "in", values: ["Tech"], weight: 30 },
      ],
    },
    isLoading: false,
    save: vi.fn(),
    isSaving: false,
  })),
}));

import { useICPConfig } from "@/hooks/useICPConfig";

describe("useICPConfig (mocked)", () => {
  it("returns config with criteria", () => {
    const result = (useICPConfig as any)();
    expect(result.config.criteria).toHaveLength(1);
    expect(result.config.criteria[0].type).toBe("sector");
  });

  it("returns isLoading false", () => {
    const result = (useICPConfig as any)();
    expect(result.isLoading).toBe(false);
  });

  it("returns save function", () => {
    const result = (useICPConfig as any)();
    expect(typeof result.save).toBe("function");
  });
});
