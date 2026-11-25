import { describe, it, expect } from "vitest";
import { groupByCurrency, formatMoney, formatCurrencyTotals } from "@/lib/money";

/** O Intl usa espaço não separável depois do símbolo; normaliza para comparar. */
const semNbsp = (s: string) => s.replace(/\u00a0/g, " ");

describe("money — totais por moeda (etapa 120)", () => {
  it("agrupa os valores por moeda em vez de somar tudo num número só", () => {
    const deals = [
      { value: 1000, currency: "BRL" },
      { value: 2000, currency: "USD" },
      { value: 500, currency: "BRL" },
    ];

    const totals = groupByCurrency(deals, (d) => d.value, (d) => d.currency);

    expect(totals).toEqual([
      { currency: "BRL", total: 1500 },
      { currency: "USD", total: 2000 },
    ]);
  });

  it("trata moeda ausente ou em branco como BRL e valor inválido como zero", () => {
    const deals = [
      { value: 100, currency: null },
      { value: "250", currency: " brl " },
      { value: null, currency: "USD" },
      { value: "abc", currency: "USD" },
    ];

    expect(groupByCurrency(deals, (d) => d.value, (d) => d.currency)).toEqual([
      { currency: "BRL", total: 350 },
      { currency: "USD", total: 0 },
    ]);
  });

  it("formata cada total com o símbolo da própria moeda", () => {
    expect(semNbsp(formatMoney(1500, "BRL"))).toBe("R$ 1.500");
    expect(semNbsp(formatMoney(2000, "USD"))).toBe("US$ 2.000");
  });

  it("não derruba a tela quando o código da moeda é inválido", () => {
    expect(semNbsp(formatMoney(10, "X"))).toBe("X 10");
  });

  it("junta os totais numa linha só", () => {
    const linha = semNbsp(
      formatCurrencyTotals([
        { currency: "BRL", total: 1500 },
        { currency: "USD", total: 2000 },
      ]),
    );

    expect(linha).toBe("R$ 1.500 · US$ 2.000");
  });

  it("devolve lista vazia quando não há item", () => {
    expect(groupByCurrency([], (d: { value: number }) => d.value, () => "BRL")).toEqual([]);
  });
});