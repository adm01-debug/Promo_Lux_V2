import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardStats: () => ({
    data: { activeWorkflows: 2, runningWorkflows: 1, totalCompanies: 100, enrichedCompanies: 50, todayScrapeJobs: 3, totalScrapeJobs: 5, completedScrapeJobs: 3 },
    isLoading: false,
  }),
  useRecentCompanies: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useWeeklyPerformance", () => ({
  useWeeklyPerformance: () => ({
    data: [
      { day: "Seg", raspadas: 10, qualificadas: 5 },
      { day: "Ter", raspadas: 15, qualificadas: 8 },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => ({
    primary: "#D4A520",
    success: "#22c55e",
    border: "#333",
    mutedFg: "#888",
  }),
}));

const MotionComponent = ({ children }: any) => <div>{children}</div>;

vi.mock("framer-motion", () => {
  const comp = ({ children }: any) => children != null ? <div>{children}</div> : <div />;
  return {
    motion: new Proxy({}, { get: () => comp }),
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => ({ get: () => 0 }),
    animate: (_mv: any, _to: any, opts: any) => {
      opts?.onUpdate?.(_to);
      return { stop: () => {} };
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} data-strokewidth={props.strokeWidth} data-dot={JSON.stringify(props.dot)} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ data: [], error: null }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
          range: () => Promise.resolve({ data: [], count: 0, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("../EnrichmentFunnel", () => ({
  EnrichmentFunnel: () => <div data-testid="enrichment-funnel" />,
}));

vi.mock("../AutomationsList", () => ({
  AutomationsList: () => <div data-testid="automations-list" />,
}));

vi.mock("../ActivityFeed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

const { DashboardView } = await import("../DashboardView");

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: any) => (
  <MemoryRouter>
    <QueryClientProvider client={qc}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

describe("DashboardView — P1 Chart Legibility", () => {
  it("renders Performance Semanal chart section", () => {
    render(<DashboardView />, { wrapper });
    expect(screen.getByText("Performance Semanal")).toBeInTheDocument();
  });

  it("renders chart with strokeWidth 2.5 for better legibility", () => {
    render(<DashboardView />, { wrapper });
    const areaRaspadas = screen.getByTestId("area-raspadas");
    expect(areaRaspadas.getAttribute("data-strokewidth")).toBe("2.5");
  });

  it("renders chart dots for data points", () => {
    render(<DashboardView />, { wrapper });
    const areaRaspadas = screen.getByTestId("area-raspadas");
    const dotData = JSON.parse(areaRaspadas.getAttribute("data-dot") || "{}");
    expect(dotData.r).toBe(3);
  });

  it("renders both area series (raspadas + qualificadas)", () => {
    render(<DashboardView />, { wrapper });
    expect(screen.getByTestId("area-raspadas")).toBeInTheDocument();
    expect(screen.getByTestId("area-qualificadas")).toBeInTheDocument();
  });

  it("renders StatsGrid section", () => {
    render(<DashboardView />, { wrapper });
    expect(screen.getByText("Workflows Ativos")).toBeInTheDocument();
    expect(screen.getByText("Empresas Encontradas")).toBeInTheDocument();
  });

  it("renders greeting message", () => {
    render(<DashboardView />, { wrapper });
    expect(screen.getByText(/👋/)).toBeInTheDocument();
  });
});
