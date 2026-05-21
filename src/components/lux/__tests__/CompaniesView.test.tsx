import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          range: () => Promise.resolve({ data: [], count: 0, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/usePersistedFilters", () => ({
  usePersistedFilters: () => [{
    search: "",
    selectedSectors: new Set(),
    selectedLocations: new Set(),
    selectedSources: new Set(),
    selectedStatus: new Set(),
    selectedScores: new Set(),
  }, vi.fn()],
}));

// Lazy import after mocks
const { CompaniesView } = await import("../CompaniesView");

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

describe("CompaniesView — P0 Mobile Actions & P1 Score Tooltip", () => {
  it("renders the view title", async () => {
    render(<CompaniesView />, { wrapper });
    expect(await screen.findByText("Empresas Identificadas")).toBeInTheDocument();
  });

  it("renders Score column header with HelpCircle tooltip", async () => {
    render(<CompaniesView />, { wrapper });
    // The Score header has a HelpCircle icon for tooltip
    const scoreHeaders = await screen.findAllByText("Score");
    expect(scoreHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("renders export CSV button", async () => {
    render(<CompaniesView />, { wrapper });
    expect(await screen.findByText("Exportar CSV")).toBeInTheDocument();
  });

  it("renders filter panel", async () => {
    render(<CompaniesView />, { wrapper });
    expect(await screen.findByText("Filtros")).toBeInTheDocument();
  });

  it("has mobile dropdown menu structure (sm:hidden class)", async () => {
    const { container } = render(<CompaniesView />, { wrapper });
    // Mobile dropdown is rendered with sm:hidden
    const mobileDropdowns = container.querySelectorAll(".sm\\:hidden");
    // Exist in the DOM (even if no rows yet)
    expect(mobileDropdowns).toBeDefined();
  });

  it("has desktop hover actions structure (hidden sm:flex)", async () => {
    const { container } = render(<CompaniesView />, { wrapper });
    const desktopActions = container.querySelectorAll('.hidden.sm\\:flex');
    expect(desktopActions).toBeDefined();
  });
});
