import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: "c1",
                name: "Campanha Teste",
                status: "active",
                prospects: 100,
                sent: 80,
                opened: 40,
                replied: 10,
                meetings: 3,
                sequence: [],
                start_date: null,
                created_at: "2026-03-01",
                updated_at: "2026-04-01",
                user_id: "u1",
              },
            ],
            error: null,
          })
        ),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { id: "u1" } })),
}));

vi.mock("@/hooks/usePermissions", () => ({
  useCan: () => true,
  usePermissions: () => ({ role: "admin", isAdmin: true, can: () => true }),
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => ({ isDemoMode: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { CampaignsView } from "../CampaignsView";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe("CampaignsView", () => {
  it("renders heading", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Campanhas de Outreach")).toBeInTheDocument();
    });
  });

  it("renders create button", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Nova Campanha")).toBeInTheDocument();
    });
  });

  it("shows campaign card when data loads", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Campanha Teste")).toBeInTheDocument();
    });
  });
});
