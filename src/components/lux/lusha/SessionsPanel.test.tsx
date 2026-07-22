import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionsPanel } from "./SessionsPanel";
import type { LushaSession } from "./types";

function makeSession(i: number, overrides: Partial<LushaSession> = {}): LushaSession {
  return {
    id: overrides.id ?? `s-${i}`,
    company_name: overrides.company_name ?? `Empresa ${String(i).padStart(2, "0")}`,
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
  return within(table).getAllByRole("row").slice(1);
};

// Sonda para inspecionar a URL viva do MemoryRouter.
function LocationProbe({ onChange }: { onChange: (search: string) => void }) {
  const loc = useLocation();
  onChange(loc.search);
  return null;
}

function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ["/"] as string[] } = {},
  onLocation: (search: string) => void = () => {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationProbe onChange={onLocation} />
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Fetcher fake que aplica filtros server-side simulados.
function makeFetcher(all: LushaSession[]) {
  const fn = vi.fn(async ({ q, status, limit }: { q: string; status: string; limit: number }) => {
    let list = all;
    if (status !== "all") list = list.filter((s) => s.status === status);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((s) => s.company_name.toLowerCase().includes(needle));
    return { rows: list.slice(0, limit), total: list.length };
  });
  return fn;
}

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 320)); // > debounce (250ms)
  });
};

beforeEach(() => {
  vi.useRealTimers();
});

describe("SessionsPanel (R36 server-side)", () => {
  it("estado vazio original quando o backend retorna zero sem filtros", async () => {
    const fetcher = makeFetcher([]);
    renderWithProviders(<SessionsPanel fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText("Nenhuma sessão registrada.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renderiza uma linha por sessão retornada pelo servidor", async () => {
    const sessions = [
      makeSession(1, { company_name: "Alpha SA", status: "success" }),
      makeSession(2, { company_name: "Beta Ltda", status: "failed" }),
      makeSession(3, { company_name: "Gama Inc", status: "pending" }),
    ];
    renderWithProviders(<SessionsPanel fetcher={makeFetcher(sessions)} />);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect(screen.getByText("Alpha SA")).toBeInTheDocument();
    expect(screen.getByText("Beta Ltda")).toBeInTheDocument();
    expect(screen.getByText("Gama Inc")).toBeInTheDocument();
  });

  it('mostra badge "+N" quando a sessão tem mais de 3 departamentos', async () => {
    renderWithProviders(
      <SessionsPanel
        fetcher={makeFetcher([
          makeSession(1, {
            company_name: "MultiDep",
            departments_requested: ["A", "B", "C", "D", "E"],
          }),
        ])}
      />,
    );
    await waitFor(() => expect(screen.getByText("MultiDep")).toBeInTheDocument());
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("filtra por texto e sincroniza com o URL (debounced)", async () => {
    const sessions = [
      makeSession(1, { company_name: "Alpha SA" }),
      makeSession(2, { company_name: "Beta Ltda" }),
      makeSession(3, { company_name: "Gamma Inc" }),
    ];
    const fetcher = makeFetcher(sessions);
    let currentSearch = "";
    renderWithProviders(
      <SessionsPanel fetcher={fetcher} />,
      {},
      (s) => {
        currentSearch = s;
      },
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "beta" },
    });
    await flush();

    await waitFor(() => expect(screen.getByText("Beta Ltda")).toBeInTheDocument());
    expect(screen.queryByText("Alpha SA")).not.toBeInTheDocument();
    expect(currentSearch).toContain("lsq=beta");
  });

  it("estado vazio filtrado quando o backend retorna zero com filtros ativos", async () => {
    const fetcher = makeFetcher([makeSession(1, { company_name: "Alpha SA" })]);
    renderWithProviders(<SessionsPanel fetcher={fetcher} />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));

    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "zzz" },
    });
    await flush();

    await waitFor(() =>
      expect(
        screen.getByText("Nenhuma sessão corresponde aos filtros."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("hidrata filtros a partir do URL na primeira renderização", async () => {
    const sessions = [
      makeSession(1, { company_name: "Alpha SA", status: "success" }),
      makeSession(2, { company_name: "Beta Ltda", status: "failed" }),
    ];
    const fetcher = makeFetcher(sessions);
    renderWithProviders(<SessionsPanel fetcher={fetcher} />, {
      initialEntries: ["/?lsq=beta&lss=failed"],
    });

    await waitFor(() => expect(screen.getByText("Beta Ltda")).toBeInTheDocument());
    expect(screen.queryByText("Alpha SA")).not.toBeInTheDocument();
    // Confirma que os filtros iniciais foram propagados ao fetcher.
    const lastCall = fetcher.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ q: "beta", status: "failed" });
  });

  it("carregamento incremental: 'Carregar mais' amplia o limite e some quando não há mais dados", async () => {
    const sessions = Array.from({ length: 23 }, (_, i) => makeSession(i + 1));
    const fetcher = makeFetcher(sessions);
    renderWithProviders(<SessionsPanel fetcher={fetcher} />);

    await waitFor(() => expect(bodyRows()).toHaveLength(10));
    expect(screen.getByText("Mostrando 10 de 23")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais sessões" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(screen.getByText("Mostrando 20 de 23")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais sessões" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(23));
    expect(screen.getByText("Mostrando 23 de 23")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Carregar mais sessões" }),
    ).not.toBeInTheDocument();
  });

  it("mudar filtro reseta o carregamento incremental para PAGE_SIZE", async () => {
    const sessions = Array.from({ length: 23 }, (_, i) => makeSession(i + 1));
    const fetcher = makeFetcher(sessions);
    renderWithProviders(<SessionsPanel fetcher={fetcher} />);
    await waitFor(() => expect(bodyRows()).toHaveLength(10));

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais sessões" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));

    fireEvent.change(screen.getByLabelText("Buscar sessão por empresa"), {
      target: { value: "Empresa" },
    });
    await flush();
    await waitFor(() => expect(bodyRows()).toHaveLength(10));
    expect(screen.getByText("Mostrando 10 de 23")).toBeInTheDocument();
  });
});
