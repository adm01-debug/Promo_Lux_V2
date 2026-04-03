import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 2, error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/viewRegistry", () => ({
  prefetchView: vi.fn(),
}));

import { Sidebar, NAV_ITEMS } from "../layout/Sidebar";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultProps = {
  activeView: "dashboard" as const,
  collapsed: false,
  mobileOpen: false,
  onNavigate: vi.fn(),
  onMobileClose: vi.fn(),
  onToggleCollapse: vi.fn(),
};

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

describe("Sidebar — P1 Dynamic Footer", () => {
  it("renders all nav items when expanded", () => {
    render(<Sidebar {...defaultProps} />, { wrapper });
    NAV_ITEMS.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it("renders system status section when expanded", () => {
    render(<Sidebar {...defaultProps} />, { wrapper });
    expect(screen.getByText("Status do Sistema")).toBeInTheDocument();
  });

  it("hides system status when collapsed", () => {
    render(<Sidebar {...defaultProps} collapsed />, { wrapper });
    expect(screen.queryByText("Status do Sistema")).not.toBeInTheDocument();
  });

  it("renders collapse button with correct text", () => {
    render(<Sidebar {...defaultProps} />, { wrapper });
    expect(screen.getByText("Recolher")).toBeInTheDocument();
  });

  it("hides nav labels when collapsed", () => {
    render(<Sidebar {...defaultProps} collapsed />, { wrapper });
    NAV_ITEMS.forEach((item) => {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });
  });

  it("renders section headers when expanded", () => {
    render(<Sidebar {...defaultProps} />, { wrapper });
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Prospecção")).toBeInTheDocument();
    expect(screen.getByText("Automação")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("highlights active view", () => {
    render(<Sidebar {...defaultProps} activeView="companies" />, { wrapper });
    const btn = screen.getByText("Empresas").closest("button");
    expect(btn?.className).toContain("bg-primary");
  });

  it("renders status indicator dot", () => {
    const { container } = render(<Sidebar {...defaultProps} />, { wrapper });
    const dot = container.querySelector(".h-2.w-2.rounded-full.animate-pulse");
    expect(dot).toBeInTheDocument();
  });

  it("renders LUX branding text", () => {
    render(<Sidebar {...defaultProps} />, { wrapper });
    expect(screen.getByText("LUX", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("IA")).toBeInTheDocument();
  });

  it("renders Sparkles icon in branding", () => {
    const { container } = render(<Sidebar {...defaultProps} />, { wrapper });
    const sparkles = container.querySelector(".lucide-sparkles");
    expect(sparkles).toBeInTheDocument();
  });
});
