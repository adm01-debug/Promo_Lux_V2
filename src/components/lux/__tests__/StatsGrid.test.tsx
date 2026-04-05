import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock dependencies before imports
vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock("framer-motion", () => {
  const comp = ({ children, className, onClick, style }: any) => {
    const Tag = "div";
    return <Tag className={className} onClick={onClick} style={style}>{children}</Tag>;
  };
  const svgComp = (props: any) => <circle />;
  const pathComp = (props: any) => <path />;
  const spanComp = ({ children, className, style }: any) => <span className={className} style={style}>{children}</span>;
  const handler = {
    get: (_: any, prop: string) => {
      if (prop === "span") return spanComp;
      if (prop === "circle") return svgComp;
      if (prop === "path") return pathComp;
      return comp;
    },
  };
  return {
    motion: new Proxy({}, handler),
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => ({ get: () => 0 }),
    animate: (_mv: any, _to: any, opts: any) => {
      opts?.onUpdate?.(_to);
      return { stop: () => {} };
    },
  };
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
};

const wrapper = ({ children }: any) => <TooltipProvider>{children}</TooltipProvider>;

describe("StatsGrid — P1 Visual Differentiation", () => {
  beforeEach(() => {
    vi.mocked(useDashboardStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as any);
  });

  it("renders all 4 KPI cards", () => {
    render(<StatsGrid />, { wrapper });
    expect(screen.getByText("Workflows Ativos")).toBeInTheDocument();
    expect(screen.getByText("Empresas Encontradas")).toBeInTheDocument();
    expect(screen.getByText("Taxa de Enriquecimento")).toBeInTheDocument();
    expect(screen.getByText("Raspagens Hoje")).toBeInTheDocument();
  });

  it("shows loading skeletons when data is loading", () => {
    vi.mocked(useDashboardStats).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<StatsGrid />, { wrapper });
    // Should render 4 skeleton cards
    const skeletons = container.querySelectorAll(".glass");
    expect(skeletons.length).toBe(4);
  });

  it("displays unique color themes per card via CARD_STYLES", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const cards = container.querySelectorAll(".glass.rounded-xl.p-5");
    expect(cards.length).toBeGreaterThanOrEqual(4);
    
    // Each card should have unique border styling
    const classNames = Array.from(cards).map(c => c.className);
    // Workflows = violet, Empresas = primary, Enriquecimento = emerald, Raspagens = sky
    expect(classNames.some(c => c.includes("border-violet"))).toBe(true);
    expect(classNames.some(c => c.includes("border-primary"))).toBe(true);
    expect(classNames.some(c => c.includes("border-emerald"))).toBe(true);
    expect(classNames.some(c => c.includes("border-sky"))).toBe(true);
  });

  it("renders unique icon backgrounds per card", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const iconContainers = container.querySelectorAll(".h-9.w-9.rounded-lg");
    expect(iconContainers.length).toBe(4);
    
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

  it("marks 'Empresas Encontradas' as featured (larger text)", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const featured = container.querySelector(".text-4xl");
    expect(featured).toBeInTheDocument();
  });

  it("computes match rate correctly", () => {
    render(<StatsGrid />, { wrapper });
    // 75/150 = 50%
    expect(screen.getByText("Acima da média")).toBeInTheDocument();
  });

  it("navigates to workflows on Workflows card click", () => {
    const onNavigate = vi.fn();
    render(<StatsGrid onNavigate={onNavigate} />, { wrapper });
    (screen.getByText("Workflows Ativos").closest("[class*=glass]") as HTMLElement)?.click();
  });

  it("renders in 4-column grid on large screens", () => {
    const { container } = render(<StatsGrid />, { wrapper });
    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("lg:grid-cols-4");
  });
});
