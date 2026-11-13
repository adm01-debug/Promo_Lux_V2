import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          then: vi.fn(),
          data: [],
          error: null,
        })),
        eq: vi.fn(() => ({ data: [], error: null })),
        data: [],
        error: null,
      })),
    })),
  },
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: "w1",
        name: "Test Workflow",
        description: "Desc",
        status: "active",
        steps: [{ id: "s1", type: "source", label: "Source", config: {} }],
        config: {},
        leads_processed: 100,
        leads_qualified: 50,
        success_rate: 80,
        last_run_at: "2026-04-01T10:00:00Z",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-04-01T10:00:00Z",
        user_id: "u1",
      },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("@/hooks/usePermissions", () => ({
  useCan: () => true,
  usePermissions: () => ({ role: "admin", isAdmin: true, can: () => true }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { WorkflowsView } from "../WorkflowsView";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("WorkflowsView", () => {
  it("renders heading", async () => {
    renderWithProviders(<WorkflowsView />);
    await waitFor(() => {
      expect(screen.getByText("Workflows de Automação")).toBeInTheDocument();
    });
  });

  it("renders create button", async () => {
    renderWithProviders(<WorkflowsView />);
    await waitFor(() => {
      expect(screen.getByText("Novo Workflow")).toBeInTheDocument();
    });
  });

  it("shows workflow cards when data loads", async () => {
    renderWithProviders(<WorkflowsView />);
    await waitFor(() => {
      expect(screen.getByText("Test Workflow")).toBeInTheDocument();
    });
  });
});
