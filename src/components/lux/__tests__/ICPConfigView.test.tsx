import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

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

import { ICPConfigView } from "../ICPConfigView";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ICPConfigView", () => {
  it("renders heading", () => {
    renderWithProviders(<ICPConfigView />);
    expect(screen.getByText("Configuração IPC")).toBeInTheDocument();
  });

  it("renders save button", () => {
    renderWithProviders(<ICPConfigView />);
    expect(screen.getByText("Salvar")).toBeInTheDocument();
  });
});
