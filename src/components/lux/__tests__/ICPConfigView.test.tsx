import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useICPConfig", () => ({
  useICPConfig: vi.fn(() => ({
    config: {
      criteria: [
        { id: "c1", type: "sector", label: "Setor", operator: "in", values: ["Tech"], weight: 30 },
        { id: "c2", type: "location", label: "Localização", operator: "in", values: ["SP"], weight: 20 },
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

  it("renders criteria from config", async () => {
    renderWithProviders(<ICPConfigView />);
    await waitFor(() => {
      expect(screen.getByText("Setor")).toBeInTheDocument();
      expect(screen.getByText("Localização")).toBeInTheDocument();
    });
  });

  it("renders save button", () => {
    renderWithProviders(<ICPConfigView />);
    expect(screen.getByText("Salvar")).toBeInTheDocument();
  });

  it("renders add criterion button", () => {
    renderWithProviders(<ICPConfigView />);
    expect(screen.getByText("Adicionar Critério")).toBeInTheDocument();
  });
});
