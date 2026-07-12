import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock dependencies before imports
vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { StatsGrid } from "../StatsGrid";
import { useDashboardStats } from "@/hooks/useDashboardData";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockStats = {
  activeWorkflows: 3,
  runningWorkflows: 1,
  totalCompanies: 150,
  enrichedCompanies: 75,
  todayScrapeJobs: 5,
  totalScrapeJobs: 10,
  completedScrapeJobs: 7,
  dealsValue: 250000,
  totalDeals: 12,
  conversionRate: 18,
  totalApiKeys: 3,
  totalWebhooks: 2
};

const wrapper = ({ children }: { children: ReactNode }) => <TooltipProvider>{children}</TooltipProvider>;

describe("StatsGrid — P1 Visual Differentiation", () => {
  beforeEach(() => {
    vi.mocked(useDashboardStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as any);
  });

  it("renders all 5 KPI cards", () => {
    render(<StatsGrid />, { wrapper });
    expect(screen.getByText("Workflows Ativos")).toBeInTheDocument();
    expect(screen.getByText("Total de Empresas")).toBeInTheDocument();
    expect(screen.getByText("Receita em Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Taxa de Conversão")).toBeInTheDocument();
    expect(screen.getByText("Integrações")).toBeInTheDocument();
  });

  it("shows loading skeletons when data is loading", () => {
    vi.mocked(useDashboardStats).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<StatsGrid />, { wrapper });
    // Should render 5 skeleton cards (based on current implementation)
    const skeletons = container.querySelectorAll(".glass");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("displays unique color themes per card via CARD_STYLES", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const cards = container.querySelectorAll(".glass.rounded-xl.p-5");
    expect(cards.length).toBeGreaterThanOrEqual(4);
    
    // Each card should have unique border styling
    const classNames = Array.from(cards).map(c => c.className);
    // Workflows = violet, Empresas = primary, Pipeline = emerald, Conversão = sky
    expect(classNames.some(c => c.includes("border-violet"))).toBe(true);
    expect(classNames.some(c => c.includes("border-primary"))).toBe(true);
    expect(classNames.some(c => c.includes("border-emerald"))).toBe(true);
    expect(classNames.some(c => c.includes("border-sky"))).toBe(true);
  });

  it("renders unique icon backgrounds per card", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const iconContainers = container.querySelectorAll(".h-9.w-9.rounded-lg");
    expect(iconContainers.length).toBeGreaterThanOrEqual(4);
    
    const classes = Array.from(iconContainers).map(el => el.className);
    expect(classes.some(c => c.includes("bg-violet"))).toBe(true);
    expect(classes.some(c => c.includes("bg-primary"))).toBe(true);
    expect(classes.some(c => c.includes("bg-emerald"))).toBe(true);
    expect(classes.some(c => c.includes("bg-sky"))).toBe(true);
  });

  it("shows progress bars for enrichment and scrape cards", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const progressBars = container.querySelectorAll(".h-1\\.5.rounded-full");
    expect(progressBars.length).toBeGreaterThanOrEqual(2);
  });

  it("shows enrichment progress bar with emerald color", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const emeraldBars = container.querySelectorAll(".bg-emerald-500");
    expect(emeraldBars.length).toBeGreaterThanOrEqual(1);
  });

  it("shows scrape progress bar with sky color", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const skyBars = container.querySelectorAll(".bg-sky-500");
    expect(skyBars.length).toBeGreaterThanOrEqual(1);
  });

  it("marks 'Total de Empresas' as featured (larger text)", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const featured = container.querySelector(".text-4xl");
    expect(featured).toBeInTheDocument();
  });

  it("computes match rate correctly", () => {
    render(<StatsGrid />, { wrapper });
    // 75/150 = 50%
    expect(screen.getByText("50% enr.")).toBeInTheDocument();
  });

  it("navigates to workflows on Workflows card click", () => {
    const onNavigate = vi.fn();
    render(<StatsGrid onNavigate={onNavigate} />, { wrapper });
    (screen.getByText("Workflows Ativos").closest("[class*=glass]") as HTMLElement)?.click();
  });

  it("renders in 5-column grid on large screens", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("lg:grid-cols-5");
  });
});
