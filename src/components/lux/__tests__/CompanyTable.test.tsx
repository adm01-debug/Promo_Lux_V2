import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyTable } from "../CompanyTable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

vi.mock("@/hooks/useDashboardData", () => ({
  useRecentCompanies: vi.fn(),
}));

import { useRecentCompanies } from "@/hooks/useDashboardData";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: any) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

const mockCompanies = [
  { id: "1", name: "Acme Corp", sector: "Tech", location: "SP", ipc_score: 92, website: "acme.com", source: "gmaps" },
  { id: "2", name: "Beta LLC", sector: "Saúde", location: "RJ", ipc_score: 78, website: null, source: "manual" },
  { id: "3", name: "Gamma SA", sector: "Varejo", location: "PR", ipc_score: 45, website: null, source: "linkedin" },
];

describe("CompanyTable — P1 Score IPC Tooltip", () => {
  it("renders Score IPC header with HelpCircle tooltip trigger", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    
    expect(screen.getByText("Score IPC")).toBeInTheDocument();
    // HelpCircle icon should be present
    const helpIcon = screen.getByText("Score IPC").closest("span")?.querySelector("svg");
    expect(helpIcon).toBeInTheDocument();
  });

  it("renders company names", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.getByText("Gamma SA")).toBeInTheDocument();
  });

  it("applies correct score color classes", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    
    // Score 92 = text-success — class is on ancestor span
    const score92 = screen.getByText("92");
    const scoreContainer92 = score92.closest("span.font-mono");
    expect(scoreContainer92?.className).toContain("text-success");
    
    // Score 78 = text-primary
    const score78 = screen.getByText("78");
    const scoreContainer78 = score78.closest("span.font-mono");
    expect(scoreContainer78?.className).toContain("text-primary");
    
    // Score 45 = text-muted-foreground (< 60)
    const score45 = screen.getByText("45");
    const scoreContainer45 = score45.closest("span.font-mono");
    expect(scoreContainer45?.className).toContain("text-muted-foreground");
  });

  it("shows loading state when loading", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<CompanyTable />, { wrapper });
    // Loading renders skeleton placeholders (divs with specific spacing)
    const loadingArea = container.querySelector(".space-y-3");
    expect(loadingArea).toBeInTheDocument();
  });

  it("shows empty state when no companies", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: [], isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    expect(screen.getByText("Nenhuma empresa ainda")).toBeInTheDocument();
  });

  it("renders table headers correctly", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("Localização")).toBeInTheDocument();
    expect(screen.getByText("Fonte")).toBeInTheDocument();
  });

  it("renders sector badges for each company", () => {
    vi.mocked(useRecentCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as any);
    render(<CompanyTable />, { wrapper });
    
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.getByText("Varejo")).toBeInTheDocument();
  });
});
