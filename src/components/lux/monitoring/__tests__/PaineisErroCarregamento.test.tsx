import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Prova que os paineis de monitoramento distinguem "falha ao carregar" de "sem dados".
 * Todas as leituras do supabase falham aqui, entao cada painel precisa mostrar o erro
 * com botao de nova tentativa em vez da mensagem de lista vazia.
 */
const estado = vi.hoisted(() => {
  const erroFalso = { message: "falha simulada no banco" };
  const builder = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      if (prop === "then") {
        return (res: (v: unknown) => void) => res({ data: null, error: erroFalso });
      }
      if (prop === "maybeSingle" || prop === "single") {
        return () => Promise.resolve({ data: null, error: erroFalso });
      }
      return () => builder;
    },
  });
  return { erroFalso, builder, fromCalls: 0 };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      estado.fromCalls += 1;
      return estado.builder;
    },
    rpc: () => Promise.resolve({ data: null, error: estado.erroFalso }),
  },
}));

vi.mock("../SlaAlertSettingsCard", () => ({ SlaAlertSettingsCard: () => null }));

vi.mock("@/hooks/useApiLatency", () => ({
  useApiLatency: () => ({ data: [], isLoading: false }),
  useApiLatencyTrend: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/useDbHealth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useDbHealth")>();
  return { ...real, useDbHealth: () => ({ data: [], isLoading: false }) };
});
vi.mock("@/hooks/useDlqHealth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useDlqHealth")>();
  return { ...real, useDlqHealth: () => ({ data: undefined, isLoading: false }) };
});
vi.mock("@/hooks/useStatusPage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useStatusPage")>();
  return {
    ...real,
    usePublicStatus: () => ({ data: undefined, isLoading: false }),
    usePublicUptime: () => ({ data: [], isLoading: false }),
  };
});
vi.mock("@/hooks/useAuditTrail", () => ({
  DEFAULT_AUDIT_FILTERS: { table: "all", action: "all", search: "", page: 1, pageSize: 20 },
  useAuditTrail: () => ({ data: undefined, isLoading: false, isError: true, refetch: () => {} }),
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-teste", activeOrg: null, setActiveOrg: () => {} }),
}));
vi.mock("@/contexts/demo-context", () => ({
  useDemo: () => ({ isDemoMode: false, demoData: null, toggleDemoMode: () => {} }),
}));
vi.mock("@/hooks/useRealtimeJobDetails", () => ({
  useRealtimeJobDetails: () => {},
}));

import { SlaTrendChart } from "../SlaTrendChart";
import { MultiQueueResilienceCard } from "../MultiQueueResilienceCard";
import { QaHistoryPanel } from "../QaHistoryPanel";
import { SlaCompliancePanel } from "../SlaCompliancePanel";
import { MonitoringView } from "../MonitoringView";
import { ChaosEngineeringPanel } from "../ChaosEngineeringPanel";
import { JobDetailsSheet } from "../JobDetailsSheet";
import { EnrichmentFunnel } from "@/components/lux/EnrichmentFunnel";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  estado.fromCalls = 0;
});

describe("painéis de monitoramento: erro não se confunde com vazio", () => {
  it("tendência de SLA mostra erro e não a mensagem de vazio", async () => {
    render(<SlaTrendChart />, { wrapper });
    expect(await screen.findByText("Erro ao carregar")).toBeInTheDocument();
    expect(screen.getByText(/Falha ao carregar a tendência de SLA/)).toBeInTheDocument();
    expect(screen.queryByText(/Sem snapshots ainda/)).not.toBeInTheDocument();
  });

  it("tendência de SLA: nova tentativa dispara outra leitura", async () => {
    render(<SlaTrendChart />, { wrapper });
    const antes = estado.fromCalls;
    fireEvent.click(await screen.findByRole("button", { name: /Tentar novamente/i }));
    await vi.waitFor(() => expect(estado.fromCalls).toBeGreaterThan(antes));
  });

  it("resiliência multi-fila mostra erro e não 'Carregando snapshots'", async () => {
    render(<MultiQueueResilienceCard />, { wrapper });
    expect(await screen.findByText("Erro ao carregar")).toBeInTheDocument();
    expect(screen.getByText(/Falha ao carregar a resiliência das filas/)).toBeInTheDocument();
    expect(screen.queryByText(/Carregando snapshots/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem snapshots de resiliência registrados/)).not.toBeInTheDocument();
  });

  it("histórico de QA mostra erro e não a mensagem de nenhuma rodada", async () => {
    render(<QaHistoryPanel />, { wrapper });
    const erros = await screen.findAllByText("Erro ao carregar");
    expect(erros.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Sem rodadas registradas ainda.")).not.toBeInTheDocument();
  });

  it("conformidade de SLA mostra erro e não 'Sem execuções concluídas'", async () => {
    render(<SlaCompliancePanel />, { wrapper });
    expect(await screen.findByText("Erro ao carregar")).toBeInTheDocument();
    expect(screen.queryByText("Sem execuções concluídas na janela selecionada.")).not.toBeInTheDocument();
  });

  it("painel de auditoria mostra erro e não 'Nenhum log crítico registrado'", async () => {
    render(<MonitoringView />, { wrapper });
    expect(await screen.findByText("Falha ao carregar a trilha de auditoria.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum log crítico registrado recentemente.")).not.toBeInTheDocument();
  });
});
describe("painéis do lote 222–225: erro não se confunde com vazio", () => {
  it("simulador de caos mostra erro e não o estado desligado", async () => {
    render(<ChaosEngineeringPanel />, { wrapper });
    expect(await screen.findByText(/Falha ao carregar o estado do chaos/)).toBeInTheDocument();
  });

  it("detalhes da execução mostram erro nas etapas e não 'Nenhuma etapa encontrada'", async () => {
    render(
      <JobDetailsSheet jobId="job-teste" open onOpenChange={() => {}} />,
      { wrapper },
    );
    expect(await screen.findByText(/Falha ao carregar as etapas/)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma etapa encontrada com os filtros atuais/)).not.toBeInTheDocument();
  });

  it("funil de enriquecimento mostra erro e não zeros", async () => {
    render(<EnrichmentFunnel />, { wrapper });
    expect(await screen.findByText(/Não foi possível carregar o funil de enriquecimento/)).toBeInTheDocument();
  });
});
