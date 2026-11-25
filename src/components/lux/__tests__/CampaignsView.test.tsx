import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SupabaseCall } from "@/test/mockSupabaseClient";

// Lista de campanhas devolvida pela consulta — mutável para os testes cobrirem
// tanto a lista cheia quanto o estado vazio.
const campanhasMock = vi.hoisted(() => ({ dados: [] as Record<string, unknown>[] }));
const chamadas = vi.hoisted(() => [] as SupabaseCall[]);

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseClientMock } = await import("@/test/mockSupabaseClient");
  return {
    supabase: createSupabaseClientMock({
      result: () => ({ data: campanhasMock.dados, error: null }),
      calls: chamadas,
    }),
  };
});

vi.mock("@/contexts/auth-context", () => ({
  useAuth: vi.fn(() => ({ user: { id: "u1" } })),
}));

vi.mock("@/hooks/usePermissions", () => ({
  useCan: () => true,
  usePermissions: () => ({ role: "admin", isAdmin: true, can: () => true }),
}));

vi.mock("@/contexts/demo-context", () => ({
  useDemo: () => ({ isDemoMode: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { CampaignsView } from "../CampaignsView";
import { setActiveOrgId } from "@/integrations/supabase/withOrg";

const ORG = "org-teste-campanhas";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

const CAMPANHA = {
  id: "c1",
  name: "Campanha Teste",
  status: "active",
  prospects: 100,
  sent: 80,
  opened: 40,
  replied: 10,
  meetings: 3,
  sequence: [],
  start_date: null,
  created_at: "2026-03-01",
  updated_at: "2026-04-01",
  user_id: "u1",
};

beforeEach(() => {
  campanhasMock.dados = [CAMPANHA];
  chamadas.length = 0;
  setActiveOrgId(ORG);
});

describe("CampaignsView", () => {
  it("renders heading", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Campanhas de Outreach")).toBeInTheDocument();
    });
  });

  it("renders create button", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Nova Campanha")).toBeInTheDocument();
    });
  });

  it("shows campaign card when data loads", async () => {
    renderWithProviders(<CampaignsView />);
    await waitFor(() => {
      expect(screen.getByText("Campanha Teste")).toBeInTheDocument();
    });
  });

  it("le as campanhas escopadas pela organizacao ativa e sem itens na lixeira", async () => {
    renderWithProviders(<CampaignsView />);
    await screen.findByText("Campanha Teste");

    expect(chamadas).toContainEqual({
      table: "campaigns",
      method: "eq",
      args: ["organization_id", ORG],
    });
    expect(chamadas).toContainEqual({
      table: "campaigns",
      method: "is",
      args: ["deleted_at", null],
    });
  });

  it("oferece criar a primeira campanha quando nao existe nenhuma", async () => {
    campanhasMock.dados = [];
    renderWithProviders(<CampaignsView />);

    const cta = await screen.findByRole("button", { name: /Criar campanha/i });
    expect(screen.getByText("Nenhuma campanha criada")).toBeInTheDocument();
    expect(screen.queryByText("Criar Campanha")).toBeNull();

    fireEvent.click(cta);

    await waitFor(() => {
      expect(screen.getByText("Criar Campanha")).toBeInTheDocument();
    });
  });
});
