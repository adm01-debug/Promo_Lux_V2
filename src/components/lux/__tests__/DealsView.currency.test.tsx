import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface DealFake {
  id: string;
  stage_id: string;
  value: number | null;
  currency: string;
}

const estado = vi.hoisted(() => ({
  deals: [] as DealFake[],
  predictions: new Map<string, { weighted_value: number }>(),
}));

const STAGES = [
  { id: "s1", name: "Aberto", color: "#3B82F6", position: 0, probability: 25, type: "open" },
];

vi.mock("@/hooks/useTaskReminders", () => ({ useTaskReminders: () => {} }));
vi.mock("@/hooks/useDeals", () => ({
  useDealStages: () => ({ data: STAGES, isLoading: false }),
  useDeals: () => ({ data: estado.deals, updateDeal: { mutate: vi.fn() } }),
}));
vi.mock("@/hooks/useDealPredictions", () => ({
  useDealPredictions: () => ({ byDealId: estado.predictions, totalWeighted: 0 }),
}));
vi.mock("@/hooks/useLeadScores", () => ({ useLeadScores: () => ({ refresh: vi.fn() }) }));
vi.mock("@/hooks/useLostReasons", () => ({
  useLostReasons: () => ({ reasons: [], isLoading: false, createReason: { mutate: vi.fn(), isPending: false }, updateReason: { mutate: vi.fn() }, deleteReason: { mutate: vi.fn() } }),
  useLostReasonStats: () => ({ data: [], isLoading: false }),
  useLostReasonSeed: () => {},
  CATEGORY_LABEL: { price: "Preco" },
}));
vi.mock("@/components/lux/permissions/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/lux/deals/DealCard", () => ({ DealCard: () => <div data-testid="deal-card" /> }));
vi.mock("@/components/lux/deals/DealDetailDrawer", () => ({ DealDetailDrawer: () => null }));
vi.mock("@/components/lux/deals/AddDealDialog", () => ({ AddDealDialog: () => null }));
vi.mock("@/components/lux/deals/StagesManagerDialog", () => ({ StagesManagerDialog: () => null }));
vi.mock("@/components/lux/deals/LostReasonsDialog", () => ({ LostReasonsDialog: () => null }));
vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

const { DealsView } = await import("../DealsView");

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

/** O Intl usa espaco nao separavel depois do simbolo. */
const normaliza = (s: string) => s.replace(/\u00a0/g, " ");

const ocorrencias = (txt: string) =>
  screen
    .getAllByText((_, el) => normaliza(el?.textContent ?? "").trim() === txt)
    .length;

describe("DealsView — total por moeda (etapa 120)", () => {
  it("mostra um total rotulado por moeda, nunca a soma das duas", () => {
    estado.deals = [
      { id: "d1", stage_id: "s1", value: 1000, currency: "BRL" },
      { id: "d2", stage_id: "s1", value: 2000, currency: "USD" },
    ];
    estado.predictions = new Map();

    render(<DealsView />, { wrapper });

    expect(ocorrencias("R$ 1.000 · US$ 2.000")).toBe(1);
    expect(ocorrencias("R$ 1.000")).toBe(1);
    expect(ocorrencias("US$ 2.000")).toBe(1);
    expect(normaliza(document.body.textContent ?? "")).not.toContain("R$ 3.000");
  });

  it("mostra o total ponderado tambem por moeda", () => {
    estado.deals = [
      { id: "d1", stage_id: "s1", value: 1000, currency: "BRL" },
      { id: "d2", stage_id: "s1", value: 2000, currency: "USD" },
    ];
    estado.predictions = new Map([
      ["d1", { weighted_value: 250 }],
      ["d2", { weighted_value: 500 }],
    ]);

    render(<DealsView />, { wrapper });

    expect(ocorrencias("R$ 250 · US$ 500")).toBe(1);
  });

  it("mantem um total unico quando todos os negocios estao na mesma moeda", () => {
    estado.deals = [
      { id: "d1", stage_id: "s1", value: 1000, currency: "BRL" },
      { id: "d2", stage_id: "s1", value: 500, currency: "BRL" },
    ];
    estado.predictions = new Map();

    render(<DealsView />, { wrapper });

    expect(ocorrencias("R$ 1.500")).toBeGreaterThanOrEqual(2);
    expect(normaliza(document.body.textContent ?? "")).not.toContain("US$");
  });
});