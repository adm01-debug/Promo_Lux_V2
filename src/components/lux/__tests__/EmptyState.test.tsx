import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
import { Search } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState icon={Search} title="Nada encontrado" description="Tente outra busca" />
    );
    expect(screen.getByText("Nada encontrado")).toBeInTheDocument();
    expect(screen.getByText("Tente outra busca")).toBeInTheDocument();
  });

  it("renders action button when actionLabel and onAction provided", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={Search}
        title="Vazio"
        description="Desc"
        actionLabel="Criar"
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByText("Criar"));
    expect(onAction).toHaveBeenCalled();
  });

  it("renders multiple action buttons", () => {
    render(
      <EmptyState
        icon={Search}
        title="Vazio"
        description="Desc"
        actions={[
          { label: "Ação 1", onClick: vi.fn() },
          { label: "Ação 2", onClick: vi.fn(), variant: "outline" },
        ]}
      />
    );
    expect(screen.getByText("Ação 1")).toBeInTheDocument();
    expect(screen.getByText("Ação 2")).toBeInTheDocument();
  });

  it("renders steps when provided", () => {
    render(
      <EmptyState
        icon={Search}
        title="Vazio"
        description="Desc"
        steps={["Passo 1", "Passo 2", "Passo 3"]}
      />
    );
    expect(screen.getByText("Passo 1")).toBeInTheDocument();
    expect(screen.getByText("Passo 2")).toBeInTheDocument();
    expect(screen.getByText("Passo 3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders no buttons when no actions provided", () => {
    render(
      <EmptyState icon={Search} title="Vazio" description="Desc" />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
