import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, NAV_ITEMS } from "../Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/viewRegistry", () => ({
  prefetchView: vi.fn(),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultProps = {
  activeView: "dashboard" as const,
  collapsed: false,
  mobileOpen: false,
  onNavigate: vi.fn(),
  onMobileClose: vi.fn(),
  onToggleCollapse: vi.fn(),
};

const renderSidebar = (overrides = {}) =>
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Sidebar {...defaultProps} {...overrides} />
      </TooltipProvider>
    </QueryClientProvider>
  );

describe("Sidebar", () => {
  it("renders all nav items when expanded", () => {
    renderSidebar();
    NAV_ITEMS.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it("hides labels when collapsed", () => {
    renderSidebar({ collapsed: true });
    NAV_ITEMS.forEach((item) => {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });
  });

  it("calls onNavigate when a nav item is clicked", () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByText("Empresas"));
    expect(onNavigate).toHaveBeenCalledWith("companies");
  });

  it("calls onToggleCollapse when collapse button is clicked", () => {
    const onToggleCollapse = vi.fn();
    renderSidebar({ onToggleCollapse });
    fireEvent.click(screen.getByText("Recolher"));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("highlights the active view", () => {
    renderSidebar({ activeView: "companies" });
    const btn = screen.getByText("Empresas").closest("button");
    expect(btn?.className).toContain("text-primary");
  });

  it("shows mobile close button when mobileOpen", () => {
    renderSidebar({ mobileOpen: true });
    const closeBtn = screen.getByLabelText("Fechar menu");
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(defaultProps.onMobileClose).toHaveBeenCalled();
  });

  it("shows section headers when expanded", () => {
    renderSidebar();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Prospecção")).toBeInTheDocument();
    expect(screen.getByText("Automação")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });
});
