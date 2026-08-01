import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockFramerMotion } from "@/test/mockFramerMotion";

vi.mock("framer-motion", () => mockFramerMotion());

import { WorkflowCard } from "../workflows/WorkflowCard";
import type { Workflow } from "@/lib/api/workflows";

const mockWorkflow: Workflow = {
  id: "wf-1",
  name: "Prospecção SP",
  description: "Pipeline automático São Paulo",
  status: "active",
  steps: [
    { id: "s1", type: "source", label: "Google Maps", provider: "gmaps" },
    { id: "s2", type: "enrich", label: "Enriquecer", provider: "Waterfall" },
  ],
  leads_processed: 500,
  leads_qualified: 120,
  success_rate: 70,
  last_run_at: "2026-04-01T12:00:00Z",
  config: {},
  created_at: "",
  updated_at: "",
  workflow_runs: [],
};

describe("WorkflowCard", () => {
  const defaultProps = {
    workflow: mockWorkflow,
    index: 0,
    isExpanded: false,
    isRunning: false,
    onToggleExpand: vi.fn(),
    onRun: vi.fn(),
    onToggleStatus: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders workflow name and description", () => {
    render(<WorkflowCard {...defaultProps} />);
    expect(screen.getByText("Prospecção SP")).toBeInTheDocument();
    expect(screen.getByText("Pipeline automático São Paulo")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<WorkflowCard {...defaultProps} />);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("calls onToggleExpand when clicked", () => {
    const onToggleExpand = vi.fn();
    render(<WorkflowCard {...defaultProps} onToggleExpand={onToggleExpand} />);
    fireEvent.click(screen.getByText("Prospecção SP"));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("shows expanded content with stats when expanded", () => {
    render(<WorkflowCard {...defaultProps} isExpanded={true} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("shows running state on button", () => {
    render(<WorkflowCard {...defaultProps} isExpanded={true} isRunning={true} />);
    expect(screen.getByText("Executando...")).toBeInTheDocument();
  });
});
