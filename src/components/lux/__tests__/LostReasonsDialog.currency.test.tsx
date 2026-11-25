import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const estado = vi.hoisted(() => ({
  stats: [
    { lost_reason_id: "r1", label: "Preco", category: "price", deal_count: 2, total_value: 3000 },
  ],
}));

vi.mock("@/hooks/useLostReasons", () => ({
  useLostReasons: () => ({
    reasons: [{ id: "r1", label: "Preco", category: "price", active: true }],
    isLoading: false,
    createReason: { mutate: vi.fn(), isPending: false },
    updateReason: { mutate: vi.fn() },
    deleteReason: { mutate: vi.fn() },
  }),
  useLostReasonStats: () => ({ data: estado.stats, isLoading: false }),
  useLostReasonSeed: () => {},
  CATEGORY_LABEL: { price: "Preco" },
}));

const { LostReasonsDialog } = await import("../deals/LostReasonsDialog");

const normaliza = (s: string) => s.replace(/\u00a0/g, " ");

const dealsPerdidos = [
  { id: "d1", stage_id: "s1", lost_reason_id: "r1", value: 1000, currency: "BRL" },
  { id: "d2", stage_id: "s1", lost_reason_id: "r1", value: 2000, currency: "USD" },
];

describe("LostReasonsDialog — valor perdido por moeda (etapa 120)", () => {
  it("nao soma moedas diferentes no valor perdido", () => {
    render(
      <LostReasonsDialog open onOpenChange={() => {}} deals={dealsPerdidos as never} />,
    );

    const texto = normaliza(document.body.textContent ?? "");

    expect(texto).toContain("R$ 1.000 · US$ 2.000");
    expect(texto).not.toContain("R$ 3.000");
  });

  it("mostra o valor do motivo por moeda ao lado da contagem", () => {
    render(
      <LostReasonsDialog open onOpenChange={() => {}} deals={dealsPerdidos as never} />,
    );

    expect(screen.getByText((_, el) => normaliza(el?.textContent ?? "").trim() === "2 · R$ 1.000 · US$ 2.000")).toBeTruthy();
  });

  it("sem negocios perdidos, nao afirma valor nenhum", () => {
    estado.stats = [];
    render(<LostReasonsDialog open onOpenChange={() => {}} deals={[]} />);

    expect(normaliza(document.body.textContent ?? "")).toContain(
      "Nenhum negócio perdido com motivo registrado ainda.",
    );
    estado.stats = [
      { lost_reason_id: "r1", label: "Preco", category: "price", deal_count: 2, total_value: 3000 },
    ];
  });
});