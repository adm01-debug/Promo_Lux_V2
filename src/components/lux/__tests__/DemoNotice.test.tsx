import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

const { DemoNotice } = await import("../DemoNotice");

describe("DemoNotice", () => {
  it("explica qual área não tem demonstração e leva para criar conta", () => {
    const onSignUp = vi.fn();
    render(<DemoNotice area="Análises" onSignUp={onSignUp} />);

    expect(screen.getByText(/Análises não está disponível na demonstração/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Criar conta gratuita/ }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it("oferece voltar ao painel quando o layout passa a navegação", () => {
    const onBack = vi.fn();
    render(<DemoNotice area="Configurações" onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao painel/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});