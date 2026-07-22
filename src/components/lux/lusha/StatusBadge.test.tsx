import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge (R30 split)", () => {
  it("renderiza estado enriched em verde-esmeralda", () => {
    render(<StatusBadge status="enriched" />);
    const badge = screen.getByText("Enriquecido");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/emerald/);
  });

  it("renderiza estado sent_to_bitrix como primary", () => {
    render(<StatusBadge status="sent_to_bitrix" />);
    expect(screen.getByText("Enviado ao Bitrix")).toBeInTheDocument();
  });

  it("fallback para status desconhecido mostra o próprio valor", () => {
    render(<StatusBadge status="whatever_new_state" />);
    expect(screen.getByText("whatever_new_state")).toBeInTheDocument();
  });

  it("fallback para null mostra travessão", () => {
    render(<StatusBadge status={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
