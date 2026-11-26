import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const toast = vi.hoisted(() => vi.fn());
const estado = vi.hoisted(() => ({
  porTabela: {} as Record<string, unknown[]>,
  erroEscrita: null as null | { message: string },
}));
const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  toggleStatus: vi.fn(),
  run: vi.fn(),
  execute: vi.fn(),
}));

// Cadeia do PostgREST: cada cadeia guarda o proprio modo (leitura/escrita), de
// forma que leituras concorrentes nunca sejam confundidas com uma escrita.
function cadeia(tabela: string): unknown {
  let modo: "select" | "write" = "select";
  let unico = false;
  const alvo = () => undefined;
  const proxy: unknown = new Proxy(alvo, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          const linhas = estado.porTabela[tabela] ?? [];
          const resultado = modo === "write"
            ? { data: null, error: estado.erroEscrita }
            : { data: unico ? linhas[0] ?? null : linhas, error: null, count: linhas.length };
          return Promise.resolve(resultado).then(resolve);
        };
      }
      if (prop === "single" || prop === "maybeSingle") { modo = "select"; unico = true; }
      if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") modo = "write";
      return () => proxy;
    },
    apply() { return proxy; },
  });
  return proxy;
}

vi.mock("@/hooks/use-toast", () => ({
  toast,
  useToast: () => ({ toast, dismiss: vi.fn(), toasts: [] }),
}));
vi.mock("@/contexts/demo-context", () => ({ useDemo: () => ({ isDemoMode: false }) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1", activeOrg: { id: "org-1", name: "Org" }, setActive: vi.fn() }),
}));
vi.mock("@/hooks/usePermissions", () => ({ useCan: () => true, usePermissions: () => ({ role: "admin", isAdmin: true, can: () => true }) }));
vi.mock("@/hooks/useRealtimeScrapeJobs", () => ({ useRealtimeScrapeJobs: () => undefined }));
vi.mock("@/hooks/unsaved-changes-context", () => ({
  useUnsavedChanges: () => ({ setHasUnsavedChanges: vi.fn(), confirmNavigation: (cb: () => void) => cb(), hasUnsavedChanges: false }),
}));
vi.mock("@/integrations/supabase/withOrg", () => ({
  db: { from: (t: string) => cadeia(t) },
  ensureSameOrg: () => true,
  getActiveOrgId: () => "org-1",
  setActiveOrgId: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => cadeia(t),
    functions: { invoke: vi.fn() },
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
  },
}));
vi.mock("@/lib/api/workflows", () => ({ workflowApi: api }));
vi.mock("@/components/lux/monitoring/JobDetailsSheet", () => ({ JobDetailsSheet: () => null }));
vi.mock("@/components/lux/monitoring/DbHealthDashboard", () => ({ DbHealthDashboard: () => null }));
vi.mock("@/components/lux/monitoring/ScrapeQueuePanel", () => ({ ScrapeQueuePanel: () => null }));
vi.mock("@/components/lux/automations/AutomationsRealtimeView", () => ({ AutomationsRealtimeView: () => null }));
vi.mock("@/components/lux/monitoring/PartitionAdvisoryPanel", () => ({ PartitionAdvisoryPanel: () => null }));
vi.mock("@/components/lux/monitoring/ResilienceSimulatorPanel", () => ({ ResilienceSimulatorPanel: () => null }));
vi.mock("@/components/lux/monitoring/CircuitBreakerPanel", () => ({ CircuitBreakerPanel: () => null }));
vi.mock("@/components/lux/monitoring/AutomationLogsPanel", () => ({ AutomationLogsPanel: () => null }));
vi.mock("@/components/lux/monitoring/AutomationStatusPanel", () => ({ AutomationStatusPanel: () => null }));
vi.mock("@/components/lux/monitoring/AuditTrailPanel", () => ({ AuditTrailPanel: () => null }));
vi.mock("@/components/lux/monitoring/ApiLatencyPanel", () => ({ ApiLatencyPanel: () => null }));
vi.mock("@/components/lux/monitoring/ApiLatencyAlertSettingsCard", () => ({ ApiLatencyAlertSettingsCard: () => null }));
vi.mock("@/components/lux/monitoring/CircuitBreakerAlertSettingsCard", () => ({ CircuitBreakerAlertSettingsCard: () => null }));
vi.mock("@/components/lux/monitoring/VaultCookiesPanel", () => ({ VaultCookiesPanel: () => null }));
vi.mock("@/components/lux/OrgProxiesView", () => ({ OrgProxiesView: () => null }));
vi.mock("@/components/lux/monitoring/DlqTriageView", () => ({ DlqTriageView: () => null }));
vi.mock("@/components/lux/monitoring/ScrapeLatencyPanel", () => ({ ScrapeLatencyPanel: () => null }));
vi.mock("@/components/lux/monitoring/IncidentsPanel", () => ({ IncidentsPanel: () => null }));
vi.mock("@/components/lux/monitoring/OrgRateLimitsView", () => ({ OrgRateLimitsView: () => null }));
vi.mock("@/components/lux/monitoring/ResilienceReport", () => ({ ResilienceReport: () => null }));
vi.mock("@/components/lux/monitoring/MultiQueueResilienceCard", () => ({ MultiQueueResilienceCard: () => null }));
vi.mock("@/components/lux/monitoring/RetryPolicyAdvisoriesPanel", () => ({ RetryPolicyAdvisoriesPanel: () => null }));
vi.mock("@/components/lux/monitoring/SystemRecoveryPanel", () => ({ SystemRecoveryPanel: () => null }));
vi.mock("@/components/lux/monitoring/MonteCarloReportPanel", () => ({ MonteCarloReportPanel: () => null }));
vi.mock("@/components/lux/monitoring/WebScrapeView", () => ({ WebScrapeView: () => null }));
vi.mock("@/components/lux/monitoring/InstagramConnectionPanel", () => ({ InstagramConnectionPanel: () => null }));
vi.mock("@/components/lux/monitoring/InstagramEnqueuePanel", () => ({ InstagramEnqueuePanel: () => null }));
vi.mock("@/components/lux/monitoring/DLQReplayPanel", () => ({ DLQReplayPanel: () => null }));
vi.mock("@/components/lux/monitoring/QaHistoryPanel", () => ({ QaHistoryPanel: () => null }));
vi.mock("@/components/lux/monitoring/ReaperHistoryPanel", () => ({ ReaperHistoryPanel: () => null }));
vi.mock("@/components/lux/monitoring/SlaCompliancePanel", () => ({ SlaCompliancePanel: () => null }));
vi.mock("@/components/lux/monitoring/SlaTrendChart", () => ({ SlaTrendChart: () => null }));
vi.mock("@/components/lux/monitoring/SlaRecommendationsCard", () => ({ SlaRecommendationsCard: () => null }));
vi.mock("@/components/lux/monitoring/SlaHistoryCard", () => ({ SlaHistoryCard: () => null }));
vi.mock("@/components/lux/monitoring/SlaAutoTuneBlockedCard", () => ({ SlaAutoTuneBlockedCard: () => null }));
vi.mock("@/components/lux/monitoring/SourceComparisonReport", () => ({ SourceComparisonReport: () => null }));
vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { WorkflowsView } from "../WorkflowsView";
import { CampaignsView } from "../CampaignsView";
import { IntentSignalsView } from "../IntentSignalsView";
import { ChaosEngineeringPanel } from "../monitoring/ChaosEngineeringPanel";
import Monitoring from "@/pages/Monitoring";

const AGORA = "2026-04-01T10:00:00.000Z";

const WORKFLOW = {
  id: "w1",
  name: "Test Workflow",
  description: "Desc",
  status: "active",
  steps: [],
  config: {},
  leads_processed: 10,
  leads_qualified: 5,
  success_rate: 50,
  last_run_at: null,
  created_at: AGORA,
  updated_at: AGORA,
  user_id: "u1",
};

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
  created_at: AGORA,
  updated_at: AGORA,
  user_id: "u1",
};

const SINAL = {
  id: "s1",
  company_name: "Alfa Ltda",
  type: "website_visit",
  signal: "Visita a pagina de precos",
  strength: "high",
  details: null,
  created_at: AGORA,
  user_id: "u1",
};

function envolver() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

function ultimoAviso() {
  return toast.mock.calls.at(-1)?.[0] as { title?: string; description?: string; variant?: string };
}

beforeEach(() => {
  toast.mockClear();
  estado.porTabela = {};
  estado.erroEscrita = null;
  api.list.mockReset();
  api.toggleStatus.mockReset();
  api.delete.mockReset();
  api.create.mockReset();
  api.update.mockReset();
  api.run.mockReset();
  api.execute.mockReset();
});

describe("avisos de erro nas mutacoes (etapa 215)", () => {
  it("avisa quando pausar o workflow falha, com o motivo do banco", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api.list.mockResolvedValue([WORKFLOW]);
    api.toggleStatus.mockRejectedValue(new Error("engine fora do ar"));
    estado.erroEscrita = { message: "permission denied for table workflows" };
    render(<WorkflowsView />, { wrapper: envolver() });

    await screen.findByText("Test Workflow");
    fireEvent.click(screen.getByText("Test Workflow"));
    fireEvent.click(await screen.findByRole("button", { name: /Pausar/ }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao ligar ou desligar o fluxo");
    expect(aviso.description).toBe("permission denied for table workflows");
    expect(aviso.variant).toBe("destructive");
    warn.mockRestore();
  });

  it("avisa quando remover o workflow falha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api.list.mockResolvedValue([WORKFLOW]);
    api.delete.mockRejectedValue(new Error("engine fora do ar"));
    estado.erroEscrita = { message: "connection reset by peer" };
    render(<WorkflowsView />, { wrapper: envolver() });

    await screen.findByText("Test Workflow");
    fireEvent.click(screen.getByText("Test Workflow"));
    fireEvent.click(await screen.findByRole("button", { name: /Remover/ }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao remover o workflow");
    expect(aviso.description).toBe("connection reset by peer");
    expect(aviso.variant).toBe("destructive");
    warn.mockRestore();
  });
});

describe("avisos de erro nas mutacoes (etapa 216)", () => {
  it("avisa quando excluir a campanha falha", async () => {
    estado.porTabela["campaigns"] = [CAMPANHA];
    estado.erroEscrita = { message: "permission denied for table campaigns" };
    const { container } = render(<CampaignsView />, { wrapper: envolver() });

    await screen.findByText("Campanha Teste");
    const botao = container.querySelector("button.text-destructive") as HTMLButtonElement;
    expect(botao).not.toBeNull();
    fireEvent.click(botao);

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao remover a campanha");
    expect(aviso.description).toBe("permission denied for table campaigns");
    expect(aviso.variant).toBe("destructive");
  });

  it("avisa quando excluir o sinal de intencao falha", async () => {
    estado.porTabela["intent_signals"] = [SINAL];
    estado.erroEscrita = { message: "permission denied for table intent_signals" };
    const { container } = render(<IntentSignalsView />, { wrapper: envolver() });

    await screen.findByText("Alfa Ltda");
    const botao = container.querySelector("button.text-destructive") as HTMLButtonElement;
    expect(botao).not.toBeNull();
    fireEvent.click(botao);

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao remover o sinal");
    expect(aviso.description).toBe("permission denied for table intent_signals");
    expect(aviso.variant).toBe("destructive");
  });

  it("avisa quando ligar o chaos falha", async () => {
    estado.porTabela["feature_flags"] = [{ id: "f1", is_enabled: false, updated_at: AGORA }];
    estado.erroEscrita = { message: "permission denied for table feature_flags" };
    render(<ChaosEngineeringPanel />, { wrapper: envolver() });

    const chave = await waitFor(() => {
      const el = document.getElementById("chaos-switch") as HTMLButtonElement | null;
      expect(el).not.toBeNull();
      expect((el as HTMLButtonElement).disabled).toBe(false);
      return el as HTMLButtonElement;
    });
    fireEvent.click(chave);

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao ligar ou desligar o chaos");
    expect(aviso.description).toBe("permission denied for table feature_flags");
    expect(aviso.variant).toBe("destructive");
  });

  it("avisa quando salvar as preferencias de alerta falha", async () => {
    estado.porTabela["automation_alerts"] = [];
    estado.erroEscrita = { message: "permission denied for table automation_alerts" };
    render(<Monitoring />, { wrapper: envolver() });

    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    const chave = await waitFor(() => {
      const el = document.getElementById("succ-push");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(chave);

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const aviso = ultimoAviso();
    expect(aviso.title).toBe("Erro ao salvar as preferências de alerta");
    expect(aviso.description).toBe("permission denied for table automation_alerts");
    expect(aviso.variant).toBe("destructive");
  });
});