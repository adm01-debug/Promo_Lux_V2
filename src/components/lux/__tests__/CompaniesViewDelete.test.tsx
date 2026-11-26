import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const toast = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  writeError: null as null | { message: string },
  mode: "select" as "select" | "write",
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/contexts/demo-context", () => ({ useDemo: () => ({ isDemoMode: false }) }));
vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1" }),
}));
vi.mock("@/hooks/usePermissions", () => ({ useCan: () => true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/usePersistedFilters", () => ({
  usePersistedFilters: () => [
    {
      search: "",
      selectedSectors: new Set(),
      selectedLocations: new Set(),
      selectedSources: new Set(),
      selectedStatus: new Set(),
      selectedScores: new Set(),
    },
    vi.fn(),
    vi.fn(),
  ],
}));

// Cadeia do PostgREST: qualquer método devolve a própria cadeia e o `await`
// resolve com o resultado definido em `state`.
function chainable(): unknown {
  const target = () => undefined;
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) =>
          Promise.resolve(
            state.mode === "select"
              ? { data: state.rows, error: null, count: state.rows.length }
              : { data: null, error: state.writeError },
          ).then(resolve);
      }
      if (prop === "select") state.mode = "select";
      if (prop === "delete" || prop === "update") state.mode = "write";
      if (prop === "eq" || prop === "in" || prop === "is" || prop === "order" || prop === "range") {
        return () => proxy;
      }
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/withOrg", () => ({
  db: { from: () => chainable() },
  ensureSameOrg: () => true,
  getActiveOrgId: () => "org-1",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => chainable(), auth: { getSession: async () => ({ data: { session: null }, error: null }) } },
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

const { CompaniesView } = await import("../CompaniesView");

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

const empresa = {
  id: "c1",
  name: "Alfa Ltda",
  sector: "Tech",
  location: "São Paulo, SP",
  ipc_score: 80,
  source: "manual",
  website: null,
  employees: "10-50",
  revenue: null,
  email: null,
  phone: null,
  enriched: false,
  starred: false,
  version: 1,
  organization_id: "org-1",
};

beforeEach(() => {
  toast.mockClear();
  state.rows = [empresa];
  state.writeError = null;
  state.mode = "select";
});

describe("CompaniesView — falha ao excluir empresa (etapas 204/205)", () => {
  it("mostra um resumo e registra o detalhe quando a exclusão individual falha por permissão", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    state.writeError = { message: 'new row violates row-level security policy for table "companies"' };
    render(<CompaniesView />, { wrapper });

    await screen.findByText("Alfa Ltda");
    fireEvent.click(screen.getAllByTitle("Excluir")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = toast.mock.calls.at(-1)?.[0] as { description?: string; variant?: string };
    expect(aviso.description).toBe("Sem permissão para excluir esta empresa.");
    expect(aviso.variant).toBe("destructive");
    expect(consoleError).toHaveBeenCalledWith(
      "Falha ao excluir empresa",
      "c1",
      expect.objectContaining({ message: expect.stringContaining("row-level security") }),
    );
    consoleError.mockRestore();
  });

  it("não promete motivo técnico: falha genérica vira resumo neutro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.writeError = { message: "connection reset by peer" };
    render(<CompaniesView />, { wrapper });

    await screen.findByText("Alfa Ltda");
    fireEvent.click(screen.getAllByTitle("Excluir")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = toast.mock.calls.at(-1)?.[0] as { description?: string };
    expect(aviso.description).toBe("Não foi possível excluir a empresa agora. Tente novamente.");
  });

  it("invalida os indicadores do painel depois da exclusão em lote", async () => {
    state.writeError = null;
    const spy = vi.spyOn(qc, "invalidateQueries");
    render(<CompaniesView />, { wrapper });

    await screen.findByText("Alfa Ltda");
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(await screen.findByRole("button", { name: /Remover/ }));

    await waitFor(() =>
      expect(spy.mock.calls.some(([arg]) => JSON.stringify(arg?.queryKey) === JSON.stringify(["dashboard-stats"]))).toBe(true),
    );
    spy.mockRestore();
  });
});