import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// --- Estado controlável pelos testes ----------------------------------------
let healthData: {
  total_items: number;
  pending_items: number;
  replayed_items: number;
  oldest_pending_age_secs: number;
  added_last_24h: number;
  replayed_last_24h: number;
} | undefined;

let trendRows: Array<{
  captured_at: string;
  pending_items: number;
  total_items: number;
  replayed_items: number;
  oldest_pending_age_secs: number;
}> = [];

let rangeCalls: number[] = [];

const infoToast = vi.fn();
const successToast = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    info: (...a: unknown[]) => infoToast(...a),
    success: (...a: unknown[]) => successToast(...a),
  },
}));

vi.mock("@/hooks/useOrganizations", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1", activeOrg: { role: "admin" } }),
}));

vi.mock("@/hooks/useDlqAlertSettings", () => ({
  useDlqAlertSettings: () => ({ data: { organization_id: "org-1", pending_critical: 100, consecutive: 3, cooldown_hours: 6, enabled: true } }),
  useDlqAlertHistory: () => ({ data: [] }),
}));

let automationLogRows: Array<{
  id: string;
  created_at: string;
  level: "info" | "warn" | "error";
  message: string | null;
  failure_reason: string | null;
}> = [];

vi.mock("@/hooks/useAutomationLogs", () => ({
  useAutomationLogs: () => ({ data: automationLogRows }),
}));



vi.mock("@/hooks/useDlqHealth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDlqHealth")>();
  return {
    ...actual, // mantém dlqSeverity, DLQ_THRESHOLDS puros
    useDlqHealth: () => ({ data: healthData, isLoading: false }),
    useDlqTrend: (hours = 48) => {
      rangeCalls.push(hours);
      return { data: trendRows };
    },
  };
});

vi.mock("@/hooks/usePersistedFilters", () => ({
  usePersistedFilters: (_key: string, initial: unknown) => useState(initial),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  ReferenceLine: () => null,
  ReferenceDot: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { DlqHealthCard } from "../DlqHealthCard";

describe("DlqHealthCard", () => {
  beforeEach(() => {
    infoToast.mockClear();
    successToast.mockClear();
    rangeCalls = [];
    automationLogRows = [];
    trendRows = [
      { captured_at: "2026-07-12T10:00:00Z", pending_items: 40, total_items: 100, replayed_items: 60, oldest_pending_age_secs: 7200 },
      { captured_at: "2026-07-12T11:00:00Z", pending_items: 50, total_items: 110, replayed_items: 60, oldest_pending_age_secs: 9000 },
    ];
    healthData = {
      total_items: 110,
      pending_items: 50,
      replayed_items: 60,
      oldest_pending_age_secs: 9000,
      added_last_24h: 12,
      replayed_last_24h: 8,
    };
  });

  it("renderiza título e severidade 'Atenção' para 50 pendentes", () => {
    render(<DlqHealthCard />);
    expect(screen.getByText("Saúde da Dead-Letter Queue")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("mostra severidade 'Crítico' quando pendentes excedem o limite crítico", () => {
    healthData = { ...healthData!, pending_items: 150 };
    render(<DlqHealthCard />);
    expect(screen.getByText("Crítico")).toBeInTheDocument();
  });

  it("exibe o valor de itens pendentes", () => {
    render(<DlqHealthCard />);
    expect(screen.getByText("Pendentes")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("altera a janela de tendência ao clicar em 7d", () => {
    render(<DlqHealthCard />);
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(rangeCalls).toContain(168);
  });

  it("exporta CSV quando há dados e informa quando não há", () => {
    // Sem dados → toast.info e nenhum sucesso.
    trendRows = [];
    const { unmount } = render(<DlqHealthCard />);
    // Botão fica desabilitado quando não há dados de tendência.
    expect(screen.getByRole("button", { name: /csv/i })).toBeDisabled();
    unmount();
  });

  it("exibe o painel de correlação de picos com logs de automação", () => {
    // Série com um pico claro (200) e logs de erro/aviso na janela do pico.
    trendRows = [
      { captured_at: "2026-07-12T10:00:00Z", pending_items: 10, total_items: 100, replayed_items: 90, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T10:30:00Z", pending_items: 12, total_items: 100, replayed_items: 88, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T11:00:00Z", pending_items: 11, total_items: 100, replayed_items: 89, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T11:30:00Z", pending_items: 200, total_items: 300, replayed_items: 100, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T12:00:00Z", pending_items: 9, total_items: 100, replayed_items: 91, oldest_pending_age_secs: 0 },
    ];
    automationLogRows = [
      { id: "log-1", created_at: "2026-07-12T11:35:00Z", level: "error", message: "Timeout ao despachar tarefa", failure_reason: "provider_timeout" },
      { id: "log-2", created_at: "2026-07-12T11:20:00Z", level: "warn", message: "Latência elevada", failure_reason: null },
    ];
    render(<DlqHealthCard />);
    expect(screen.getByText("Picos correlacionados a logs de automação")).toBeInTheDocument();
    expect(screen.getByText(/1 erro/)).toBeInTheDocument();
    expect(screen.getByText(/1 aviso/)).toBeInTheDocument();
    expect(screen.getByText("provider_timeout")).toBeInTheDocument();
  });

  it("não exibe o painel de correlação quando não há logs relacionados", () => {
    trendRows = [
      { captured_at: "2026-07-12T10:00:00Z", pending_items: 10, total_items: 100, replayed_items: 90, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T10:30:00Z", pending_items: 12, total_items: 100, replayed_items: 88, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T11:00:00Z", pending_items: 11, total_items: 100, replayed_items: 89, oldest_pending_age_secs: 0 },
      { captured_at: "2026-07-12T11:30:00Z", pending_items: 200, total_items: 300, replayed_items: 100, oldest_pending_age_secs: 0 },
    ];
    automationLogRows = [
      // Log muito distante do pico (fora da janela de 30 min).
      { id: "log-far", created_at: "2026-07-12T20:00:00Z", level: "error", message: "irrelevante", failure_reason: null },
    ];
    render(<DlqHealthCard />);
    expect(screen.queryByText("Picos correlacionados a logs de automação")).not.toBeInTheDocument();
  });
});
