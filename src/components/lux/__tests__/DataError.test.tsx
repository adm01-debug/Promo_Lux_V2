import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataError } from "../DataError";

describe("DataError", () => {
  it("renders default error message", () => {
    render(<DataError />);
    expect(screen.getByText("Erro ao carregar")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar os dados.")).toBeInTheDocument();
  });

  it("renders custom error message", () => {
    render(<DataError message="Falha na conexão" />);
    expect(screen.getByText("Falha na conexão")).toBeInTheDocument();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<DataError onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<DataError />);
    expect(screen.queryByText("Tentar novamente")).not.toBeInTheDocument();
  });
});
