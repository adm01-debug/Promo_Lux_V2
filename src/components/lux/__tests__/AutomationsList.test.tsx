import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupabaseCall } from "@/test/mockSupabaseClient";

const { toggleStatus, rows } = vi.hoisted(() => ({
  toggleStatus: vi.fn(() => Promise.resolve()),
  rows: [] as Array<Record<string, unknown>>,
}));
const chamadas = vi.hoisted(() => [] as SupabaseCall[]);

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseClientMock } = await import("@/test/mockSupabaseClient");
  return {
    supabase: createSupabaseClientMock({
      result: () => ({ data: rows, error: null }),
      calls: chamadas,
    }),
  };
});

vi.mock("@/lib/api/workflows", () => ({ workflowApi: { toggleStatus } }));

vi.mock("@/hooks/usePermissions", () => ({ useCan: () => true }));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { AutomationsList } from "../AutomationsList";
import { setActiveOrgId } from "@/integrations/supabase/withOrg";

const ORG = "org-teste-automacoes";

const baseWorkflow = {
  id: "w1",
  name: "Workflow Alfa",
  description: null,
  status: "active",
  success_rate: 50,
  last_run_at: null,
  leads_processed: 10,
  leads_qualified: 2,
  config: {},
  steps: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  user_id: "u1",
};

function setRows(items: Array<Record<string, unknown>>) {
  rows.splice(0, rows.length, ...items);
}

function renderList(props: { onNavigate?: (view: string) => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AutomationsList {...props} />
    </QueryClientProvider>,
  );
}

describe("AutomationsList", () => {
  beforeEach(() => {
    toggleStatus.mockClear();
    chamadas.length = 0;
    setActiveOrgId(ORG);
    setRows([]);
  });

  it("le os workflows escopados pela organizacao ativa e sem itens na lixeira", async () => {
    setRows([baseWorkflow]);
    renderList();
    await screen.findByText("Workflow Alfa");

    expect(chamadas).toContainEqual({
      table: "workflows",
      method: "eq",
      args: ["organization_id", ORG],
    });
    expect(chamadas).toContainEqual({
      table: "workflows",
      method: "is",
      args: ["deleted_at", null],
    });
  });

  it("navega para a tela de automacoes pelo botao Nova", async () => {
    setRows([baseWorkflow]);
    const onNavigate = vi.fn();
    renderList({ onNavigate });
    await screen.findByText("Workflow Alfa");

    fireEvent.click(screen.getByRole("button", { name: /nova/i }));

    expect(onNavigate).toHaveBeenCalledWith("workflows");
  });

  it("mostra botao de criar workflow no estado vazio e navega", async () => {
    const onNavigate = vi.fn();
    renderList({ onNavigate });

    const button = await screen.findByRole("button", {
      name: /criar workflow/i,
    });
    fireEvent.click(button);

    expect(onNavigate).toHaveBeenCalledWith("workflows");
  });

  it("pausa o workflow ativo", async () => {
    setRows([baseWorkflow]);
    renderList();
    await screen.findByText("Workflow Alfa");

    fireEvent.click(screen.getByLabelText(/Pausar automa/));

    await waitFor(() =>
      expect(toggleStatus).toHaveBeenCalledWith("w1", "paused"),
    );
  });

  it("retoma o workflow pausado", async () => {
    setRows([{ ...baseWorkflow, status: "paused" }]);
    renderList();
    await screen.findByText("Workflow Alfa");

    fireEvent.click(screen.getByLabelText(/Retomar automa/));

    await waitFor(() =>
      expect(toggleStatus).toHaveBeenCalledWith("w1", "active"),
    );
  });

  it("nao mostra controle de pausa em estado sem efeito", async () => {
    setRows([{ ...baseWorkflow, status: "draft" }]);
    renderList();
    await screen.findByText("Workflow Alfa");

    expect(screen.queryByLabelText(/Pausar automa/)).toBeNull();
    expect(screen.queryByLabelText(/Retomar automa/)).toBeNull();
  });
});
