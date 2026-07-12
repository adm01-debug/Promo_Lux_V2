import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyTable } from "../CompanyTable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

vi.mock("@/hooks/useVirtualCompanies", () => ({
  useVirtualCompanies: vi.fn(),
}));

// Virtualization: render every provided item so assertions can find rows in jsdom
// (jsdom has no layout, so the real hook would compute a 0px container height).
vi.mock("@/hooks/useVirtualization", () => ({
  useVirtualization: (items: Array<Record<string, unknown>>) => ({
    virtualItems: (items ?? []).map((item, index) => ({ item, index, top: index * 72 })),
    totalHeight: (items ?? []).length * 72,
    startIndex: 0,
    endIndex: Math.max(0, (items ?? []).length - 1),
    onScroll: () => {},
  }),
}));

import { useVirtualCompanies } from "@/hooks/useVirtualCompanies";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

const mockCompanies = [
  { id: "1", name: "Acme Corp", sector: "Tech", location: "SP", ipc_score: 92, website: "acme.com", source: "gmaps" },
  { id: "2", name: "Beta LLC", sector: "Saúde", location: "RJ", ipc_score: 78, website: null, source: "manual" },
  { id: "3", name: "Gamma SA", sector: "Varejo", location: "PR", ipc_score: 45, website: null, source: "linkedin" },
];

describe("CompanyTable — Virtualized list", () => {
  it("renders Score IPC header", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });
    expect(screen.getByText("Score IPC")).toBeInTheDocument();
  });

  it("renders company names", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.getByText("Gamma SA")).toBeInTheDocument();
  });

  it("applies correct score color classes", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });

    // Score 92 = text-success — class is on the font-mono span
    const scoreContainer92 = screen.getByText("92").closest("span.font-mono");
    expect(scoreContainer92?.className).toContain("text-success");

    // Score 78 = text-primary
    const scoreContainer78 = screen.getByText("78").closest("span.font-mono");
    expect(scoreContainer78?.className).toContain("text-primary");

    // Score 45 = text-muted-foreground (< 60)
    const scoreContainer45 = screen.getByText("45").closest("span.font-mono");
    expect(scoreContainer45?.className).toContain("text-muted-foreground");
  });

  it("shows loading state when loading", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useVirtualCompanies>);
    const { container } = render(<CompanyTable />, { wrapper });
    const loadingArea = container.querySelector(".space-y-3");
    expect(loadingArea).toBeInTheDocument();
  });

  it("shows empty state when no companies", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });
    expect(screen.getByText("Nenhuma empresa ainda")).toBeInTheDocument();
  });

  it("renders table headers correctly", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });

    expect(screen.getByText("Empresa / CNPJ")).toBeInTheDocument();
    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("Localização")).toBeInTheDocument();
    expect(screen.getByText("Fonte")).toBeInTheDocument();
  });

  it("renders sector badges for each company", () => {
    vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
    render(<CompanyTable />, { wrapper });

    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.getByText("Varejo")).toBeInTheDocument();
  });
});
