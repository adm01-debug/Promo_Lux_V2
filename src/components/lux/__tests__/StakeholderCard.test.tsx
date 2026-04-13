import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockFramerMotion } from "@/test/mockFramerMotion";

vi.mock("framer-motion", () => mockFramerMotion());

import { StakeholderCard, getInitials, getSeniority, getScoreGradient } from "../stakeholders/StakeholderCard";

describe("StakeholderCard utilities", () => {
  it("getInitials returns first+last initials", () => {
    expect(getInitials("Carlos Mendes")).toBe("CM");
    expect(getInitials("Ana")).toBe("AN");
  });

  it("getSeniority returns correct config", () => {
    expect(getSeniority("c-level").label).toBe("C-Level");
    expect(getSeniority(null).label).toBe("Outro");
  });

  it("getScoreGradient returns gradient classes", () => {
    expect(getScoreGradient(90)).toContain("emerald");
    expect(getScoreGradient(50)).toContain("amber");
    expect(getScoreGradient(30)).toContain("red");
  });
});

describe("StakeholderCard", () => {
  const stakeholder = {
    id: "s1",
    full_name: "Carlos Mendes",
    role: "CTO",
    department: "Tecnologia",
    seniority: "c-level",
    email: "carlos@test.com",
    linkedin_url: "https://linkedin.com/in/carlos",
    confidence_score: 92,
    tags: ["decisor", "tech"],
  };

  const defaultProps = {
    stakeholder,
    index: 0,
    isExpanded: false,
    copiedEmail: null,
    onToggleExpand: vi.fn(),
    onCopyEmail: vi.fn(),
  };

  it("renders name, role, and score", () => {
    render(<StakeholderCard {...defaultProps} />);
    expect(screen.getByText("Carlos Mendes")).toBeInTheDocument();
    expect(screen.getByText("CTO")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
  });

  it("renders seniority and department badges", () => {
    render(<StakeholderCard {...defaultProps} />);
    expect(screen.getByText("C-Level")).toBeInTheDocument();
    expect(screen.getByText("Tecnologia")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<StakeholderCard {...defaultProps} />);
    expect(screen.getByText("#decisor")).toBeInTheDocument();
    expect(screen.getByText("#tech")).toBeInTheDocument();
  });

  it("calls onCopyEmail when email is clicked", () => {
    const onCopyEmail = vi.fn();
    render(<StakeholderCard {...defaultProps} onCopyEmail={onCopyEmail} />);
    fireEvent.click(screen.getByText("carlos@test.com"));
    expect(onCopyEmail).toHaveBeenCalledWith("carlos@test.com");
  });

  it("renders LinkedIn link", () => {
    render(<StakeholderCard {...defaultProps} />);
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
  });

  it("shows 'Sem dados de contato' when no email/linkedin", () => {
    render(<StakeholderCard {...defaultProps} stakeholder={{ ...stakeholder, email: null, linkedin_url: null }} />);
    expect(screen.getByText("Sem dados de contato")).toBeInTheDocument();
  });
});
