import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

// --- Mocks de hooks (isolam o componente da rede/estado global) -------------
const mockSettings = {
  organization_id: "org-1",
  pending_critical: 100,
  consecutive: 3,
  cooldown_hours: 6,
  enabled: true,
};

let historyRows: Array<{
  id: string;
  triggered_at: string;
  pending_items: number;
  pending_critical: number;
  consecutive: number;
  admins_notified: number;
}> = [];

const saveMutate = vi.fn();
let role = "admin";

vi.mock("@/hooks/useOrganizations", () => ({
  useActiveOrganization: () => ({
    activeOrgId: "org-1",
    activeOrg: { role },
  }),
}));

vi.mock("@/hooks/useDlqAlertSettings", () => ({
  DLQ_ALERT_DEFAULTS: {
    pending_critical: 100,
    consecutive: 3,
    cooldown_hours: 6,
    enabled: true,
  },
  useDlqAlertSettings: () => ({ data: mockSettings, isLoading: false }),
  useSaveDlqAlertSettings: () => ({ mutate: saveMutate, isPending: false }),
  useDlqAlertHistory: () => ({ data: historyRows }),
}));

// Usa useState real para que setPrefs dispare re-render (comportamento fiel).
vi.mock("@/hooks/usePersistedFilters", () => ({
  usePersistedFilters: (_key: string, initial: unknown) => {
    const seed = (globalThis as Record<string, unknown>).__pfSeed ?? initial;
    return useState(seed);
  },
}));

// Recharts não mede layout em jsdom — substituímos por stubs inertes.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

import { DlqAlertSettingsCard } from "../DlqAlertSettingsCard";

function makeHistory() {
  return [
    { id: "a", triggered_at: "2026-07-12T10:00:00Z", pending_items: 120, pending_critical: 100, consecutive: 3, admins_notified: 2 },
    { id: "b", triggered_at: "2026-07-12T09:00:00Z", pending_items: 300, pending_critical: 100, consecutive: 3, admins_notified: 1 },
  ];
}

describe("DlqAlertSettingsCard", () => {
  beforeEach(() => {
    saveMutate.mockClear();
    role = "admin";
    historyRows = makeHistory();
    (globalThis as Record<string, unknown>).__pfSeed = { periodHours: null, sortKey: "date", sortDir: "desc" };
  });

  it("renderiza título e campos de configuração", () => {
    render(<DlqAlertSettingsCard />);
    expect(screen.getByText("Alertas da Dead-Letter Queue")).toBeInTheDocument();
    expect(screen.getByLabelText("Limite crítico (pendentes)")).toHaveValue(100);
  });

  it("chama a mutação de salvar com valores saneados ao clicar em Salvar", () => {
    render(<DlqAlertSettingsCard />);
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ pending_critical: 100, consecutive: 3, cooldown_hours: 6 })
    );
  });

  it("desabilita edição para não-administradores", () => {
    role = "member";
    render(<DlqAlertSettingsCard />);
    expect(screen.getByLabelText("Limite crítico (pendentes)")).toBeDisabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });

  it("ordena o histórico por volume ao clicar no botão Volume", () => {
    render(<DlqAlertSettingsCard />);
    // Ordem inicial (data desc): 'a' (mais recente) primeiro → 120.
    const listBefore = screen.getByRole("list");
    expect(within(listBefore).getAllByText(/120|300/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /volume/i }));
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    // Volume desc → 300 (item 'b') deve aparecer primeiro.
    expect(items[0]).toHaveTextContent("300");
  });

  it("exibe estatística de pico do período", () => {
    render(<DlqAlertSettingsCard />);
    expect(screen.getByText("Pico")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });
});
