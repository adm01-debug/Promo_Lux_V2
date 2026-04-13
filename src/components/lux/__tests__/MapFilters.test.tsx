import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockFramerMotion } from "@/test/mockFramerMotion";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

vi.mock("framer-motion", () => mockFramerMotion());

import { MapFilters } from "../map/MapFilters";

describe("MapFilters", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    minScore: 0,
    onMinScoreChange: vi.fn(),
    selectedSector: "all",
    onSectorChange: vi.fn(),
    sectors: ["Fintech", "AgTech", "HealthTech"],
    filteredCount: 42,
  };

  it("renders search input and filter count", () => {
    render(<MapFilters {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Buscar empresa/i)).toBeInTheDocument();
    expect(screen.getByText("42 resultados")).toBeInTheDocument();
  });

  it("displays IPC score label with current value", () => {
    render(<MapFilters {...defaultProps} minScore={50} />);
    const label = screen.getByText(/IPC Score mínimo/);
    expect(label).toHaveTextContent("50");
  });

  it("calls onSearchChange when typing", () => {
    const onSearchChange = vi.fn();
    render(<MapFilters {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar empresa/i), { target: { value: "test" } });
    expect(onSearchChange).toHaveBeenCalledWith("test");
  });

  it("renders legend items", () => {
    render(<MapFilters {...defaultProps} />);
    expect(screen.getByText("IPC ≥ 70")).toBeInTheDocument();
    expect(screen.getByText("IPC 40–69")).toBeInTheDocument();
  });
});
