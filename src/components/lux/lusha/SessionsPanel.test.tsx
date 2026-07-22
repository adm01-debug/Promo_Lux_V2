import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { SessionsPanel } from "./SessionsPanel";
import type { LushaSession } from "./types";

function makeSession(overrides: Partial<LushaSession> = {}): LushaSession {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company_name: overrides.company_name ?? "ACME Ltda",
    departments_requested: overrides.departments_requested ?? ["Vendas"],
    departments_mapped: overrides.departments_mapped ?? null,
    total_found: overrides.total_found ?? 3,
    status: overrides.status ?? "success",
    error_message: overrides.error_message ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

const bodyRows = () => {
  const table = screen.queryByRole("table");
  if (!table) return [];
  return within(table).getAllByRole("row").slice(1); // drop header
};

// useDeferredValue precisa de um tick para reprocessar.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("SessionsPanel (R32 split)", () => {
  it("estado vazio original quando não há sessões", () => {
    render(<SessionsPanel sessions={[]} />);
    expect(screen.getByText("Nenhuma sessão registrada.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar sessão por empresa")).not.toBeInTheDocument();
  });

  it("renderiza uma linha por sessão com empresa e status", () => {
    const sessions = [
      makeSession({ company_name: "Alpha SA", status: "success" }),
      makeSession({ company_name: "Beta Ltda", status: "failed" }),
      makeSession({ company_name: "Gama Inc", status: "pending" }),
    ];
    render(<SessionsPanel sessions={sessions} />);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText("Alpha SA")).toBeInTheDocument();
    expect(screen.getByText("Beta Ltda")).toBeInTheDocument();
    expect(screen.getByText("Gama Inc")).toBeInTheDocument();
  });

  it('mostra badge "+N" quando a sessão tem mais de 3 departamentos', () => {
    render(
      <SessionsPanel
        sessions={[
          makeSession({
            company_name: "MultiDep",
            departments_requested: ["A", "B", "C", "D", "E"],
          }),
        ]}
      />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("filtra por texto de empresa (case-insensitive)", async () => {
    render(
      <SessionsPanel
        sessions={[
          makeSession({ company_name: "Alpha SA" }),
          makeSession({ company_name: "Beta Ltda" }),
          makeSession({ company_name: "Gamma Inc" }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "beta" },
    });
    await flush();
    expect(screen.getByText("Beta Ltda")).toBeInTheDocument();
    expect(screen.queryByText("Alpha SA")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma Inc")).not.toBeInTheDocument();
  });

  it("mostra estado vazio filtrado quando nada corresponde", async () => {
    render(
      <SessionsPanel
        sessions={[
          makeSession({ company_name: "Alpha SA" }),
          makeSession({ company_name: "Beta Ltda" }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "zzz" },
    });
    await flush();
    expect(screen.getByText("Nenhuma sessão corresponde aos filtros.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("paginação: 12 sessões com pageSize=5 → 5/5/2 e botões corretos", async () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSession({
        id: `s-${i}`,
        company_name: `Empresa ${String(i + 1).padStart(2, "0")}`,
      }),
    );
    render(<SessionsPanel sessions={sessions} />);

    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Página anterior")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Próxima página"));
    await flush();
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Próxima página"));
    await flush();
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).toBeDisabled();
  });

  it("digitar no filtro reseta a página para 1", async () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSession({ id: `s-${i}`, company_name: `Empresa ${i}` }),
    );
    render(<SessionsPanel sessions={sessions} />);
    fireEvent.click(screen.getByLabelText("Próxima página"));
    fireEvent.click(screen.getByLabelText("Próxima página"));
    await flush();
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "Empresa" },
    });
    await flush();
    expect(screen.getByText(/Página 1 de/)).toBeInTheDocument();
  });
});
