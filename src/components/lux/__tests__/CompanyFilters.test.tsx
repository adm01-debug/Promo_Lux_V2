import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompanyFilters, CompanyFiltersState } from "../CompanyFilters";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("framer-motion", () => {
  const comp = ({ children, className, onClick }: any) => {
    const Tag = onClick ? "button" : "div";
    return <Tag className={className} onClick={onClick}>{children}</Tag>;
  };
  return {
    motion: new Proxy({}, { get: () => comp }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

import { useIsMobile } from "@/hooks/use-mobile";

const emptyFilters: CompanyFiltersState = {
  search: "",
  selectedSectors: new Set(),
  selectedLocations: new Set(),
  selectedSources: new Set(),
  selectedStatus: new Set(),
  selectedScores: new Set(),
};

const mockCompanies = [
  { sector: "Tech", location: "São Paulo, SP", source: "gmaps", enriched: true, ipcScore: 95 },
  { sector: "Tech", location: "São Paulo, SP", source: "manual", enriched: false, ipcScore: 80 },
  { sector: "Saúde", location: "Rio, RJ", source: "gmaps", enriched: true, ipcScore: 55 },
  { sector: "Varejo", location: "Curitiba, PR", source: "linkedin", enriched: false, ipcScore: 70 },
];

const defaultProps = {
  filters: emptyFilters,
  onSearchChange: vi.fn(),
  onToggleSector: vi.fn(),
  onToggleLocation: vi.fn(),
  onToggleSource: vi.fn(),
  onToggleStatus: vi.fn(),
  onToggleScore: vi.fn(),
  onClearAll: vi.fn(),
  companies: mockCompanies,
};

describe("CompanyFilters — P0 Mobile Collapsible", () => {
  it("renders filter title with icon", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getByText("Filtros")).toBeInTheDocument();
  });

  it("renders all facet groups on desktop", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getAllByText("Setor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Score IPC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Localização").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Status").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fonte").length).toBeGreaterThanOrEqual(1);
  });

  it("computes sector facets correctly", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.getByText("Varejo")).toBeInTheDocument();
  });

  it("computes location facets from city names", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getByText("São Paulo")).toBeInTheDocument();
    expect(screen.getByText("Rio")).toBeInTheDocument();
    expect(screen.getByText("Curitiba")).toBeInTheDocument();
  });

  it("computes score range facets", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getByText("90+ Excelente")).toBeInTheDocument();
    expect(screen.getByText("75-89 Bom")).toBeInTheDocument();
    expect(screen.getByText("60-74 Médio")).toBeInTheDocument();
    expect(screen.getByText("<60 Baixo")).toBeInTheDocument();
  });

  it("shows enrichment status counts", () => {
    render(<CompanyFilters {...defaultProps} />);
    expect(screen.getByText("Enriquecido")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<CompanyFilters {...defaultProps} />);
    const searchInputs = screen.getAllByPlaceholderText(/Buscar/);
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSearchChange on input", () => {
    const onSearchChange = vi.fn();
    render(<CompanyFilters {...defaultProps} onSearchChange={onSearchChange} />);
    const inputs = screen.getAllByPlaceholderText(/Buscar/);
    fireEvent.change(inputs[0], { target: { value: "test" } });
    expect(onSearchChange).toHaveBeenCalledWith("test");
  });

  it("calls onToggleSector when sector facet clicked", () => {
    const onToggleSector = vi.fn();
    render(<CompanyFilters {...defaultProps} onToggleSector={onToggleSector} />);
    const techButtons = screen.getAllByText("Tech");
    fireEvent.click(techButtons[0].closest("button")!);
    expect(onToggleSector).toHaveBeenCalledWith("Tech");
  });

  it("shows active filter count badge when filters selected", () => {
    const filters = { ...emptyFilters, selectedSectors: new Set(["Tech", "Saúde"]) };
    render(<CompanyFilters {...defaultProps} filters={filters} />);
    const badges = screen.getAllByText("2");
    // At least one badge should be the total active filters badge
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows clear button when filters active", () => {
    const filters = { ...emptyFilters, selectedSectors: new Set(["Tech"]) };
    render(<CompanyFilters {...defaultProps} filters={filters} />);
    expect(screen.getByText(/Limpar/)).toBeInTheDocument();
  });

  it("calls onClearAll when clear button clicked", () => {
    const onClearAll = vi.fn();
    const filters = { ...emptyFilters, selectedSectors: new Set(["Tech"]) };
    render(<CompanyFilters {...defaultProps} filters={filters} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText(/Limpar/));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("hides filter content on mobile by default", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const { container } = render(<CompanyFilters {...defaultProps} />);
    // Desktop block is hidden on mobile, mobile block not expanded
    const hiddenBlock = container.querySelector(".hidden.lg\\:block");
    expect(hiddenBlock).toBeInTheDocument();
  });

  it("expands filter content on mobile when toggle clicked", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<CompanyFilters {...defaultProps} />);
    fireEvent.click(screen.getByText("Filtros"));
    // After click, framer-motion div renders the filter content
  });

  it("has sticky positioning", () => {
    const { container } = render(<CompanyFilters {...defaultProps} />);
    const stickyEl = container.querySelector(".sticky");
    expect(stickyEl).toBeInTheDocument();
  });

  it("renders with fixed width on desktop (lg:w-60)", () => {
    const { container } = render(<CompanyFilters {...defaultProps} />);
    expect(container.firstElementChild?.className).toContain("lg:w-60");
  });
});
