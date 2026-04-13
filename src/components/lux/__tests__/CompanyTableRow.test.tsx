import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockFramerMotion } from "@/test/mockFramerMotion";

vi.mock("framer-motion", () => mockFramerMotion());

import { CompanyTableRow, HighlightText } from "../companies/CompanyTableRow";

describe("HighlightText", () => {
  it("highlights matching text", () => {
    const { container } = render(<HighlightText text="FinEdge Pagamentos" query="edge" />);
    expect(container.querySelector("mark")).toHaveTextContent("Edge");
  });

  it("returns plain text when no match", () => {
    const { container } = render(<HighlightText text="FinEdge" query="xyz" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container).toHaveTextContent("FinEdge");
  });

  it("returns plain text for short queries", () => {
    const { container } = render(<HighlightText text="FinEdge" query="F" />);
    expect(container.querySelector("mark")).toBeNull();
  });
});

describe("CompanyTableRow", () => {
  const company = {
    id: "c1",
    name: "FinEdge Pagamentos",
    sector: "Fintech",
    location: "São Paulo, SP",
    ipcScore: 95,
    source: "manual",
    email: "contato@finedge.com",
    phone: "11999999999",
    employees: "50-200",
    revenue: "R$ 5M",
    enriched: true,
    starred: false,
    website: "https://finedge.com",
  };

  const defaultProps = {
    company,
    index: 0,
    isSelected: false,
    searchQuery: "",
    onSelect: vi.fn(),
    onToggleStar: vi.fn(),
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  const renderInTable = (props = defaultProps) =>
    render(
      <table><tbody><CompanyTableRow {...props} /></tbody></table>
    );

  it("renders company name and email", () => {
    renderInTable();
    expect(screen.getByText("FinEdge Pagamentos")).toBeInTheDocument();
    expect(screen.getByText("contato@finedge.com")).toBeInTheDocument();
  });

  it("renders IPC score", () => {
    renderInTable();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("renders enriched badge", () => {
    renderInTable();
    expect(screen.getByText("Enriquecido")).toBeInTheDocument();
  });

  it("renders pending badge when not enriched", () => {
    renderInTable({ ...defaultProps, company: { ...company, enriched: false } });
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("calls onOpen when row is clicked", () => {
    const onOpen = vi.fn();
    renderInTable({ ...defaultProps, onOpen });
    // Click the row itself (tr element), not a child that stops propagation
    const row = screen.getByText("FinEdge Pagamentos").closest("tr")!;
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(company);
  });

  it("calls onToggleStar when star is clicked", () => {
    const onToggleStar = vi.fn();
    renderInTable({ ...defaultProps, onToggleStar });
    // Star is in a td - find the star icon's parent cell
    const starCells = screen.getAllByRole("cell");
    fireEvent.click(starCells[1]); // Star is the 2nd cell
    expect(onToggleStar).toHaveBeenCalledWith("c1", true);
  });
});
