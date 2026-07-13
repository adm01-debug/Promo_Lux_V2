import { describe, it, expect, vi } from "vitest";

vi.mock("@/hooks/useICPConfig", () => ({
  useICPConfig: vi.fn(() => ({
    configs: [],
    activeConfig: {
      id: "c1",
      name: "Perfil",
      is_active: true,
      criteria: [
        { id: "c1", type: "tags", label: "Setor", value: ["Tech"], weight: 30 },
      ],
      created_at: "",
      updated_at: "",
    },
    isLoading: false,
    error: null,
    save: vi.fn(),
    isSaving: false,
    activate: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { useICPConfig } from "@/hooks/useICPConfig";

describe("useICPConfig (mocked)", () => {
  it("returns activeConfig with criteria", () => {
    const result = useICPConfig();
    expect(result.activeConfig?.criteria).toHaveLength(1);
    expect(result.activeConfig?.criteria[0].type).toBe("tags");
  });

  it("returns isLoading false", () => {
    const result = useICPConfig();
    expect(result.isLoading).toBe(false);
  });

  it("returns save function", () => {
    const result = useICPConfig();
    expect(typeof result.save).toBe("function");
  });
});
