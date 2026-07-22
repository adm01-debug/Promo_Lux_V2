import { describe, it, expect } from "vitest";
import { DEPT_GROUPS } from "./constants";
import type { DeptGroup } from "./types";

describe("DEPT_GROUPS (R34) — estrutura e invariantes", () => {
  it("expõe exatamente 5 grupos", () => {
    expect(DEPT_GROUPS).toHaveLength(5);
  });

  it("labels PT-BR canônicos em ordem estável", () => {
    expect(DEPT_GROUPS.map((g) => g.label)).toEqual([
      "Compras & Operações",
      "Comercial & Marketing",
      "Pessoas & Gestão",
      "Finanças & TI",
      "Outros",
    ]);
  });

  it.each(DEPT_GROUPS)("grupo '$label' tem label não-vazio e items não-vazio", (g) => {
    expect(g.label.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(g.items)).toBe(true);
    expect(g.items.length).toBeGreaterThan(0);
    for (const item of g.items) {
      expect(typeof item).toBe("string");
      expect(item.trim().length).toBeGreaterThan(0);
    }
  });

  it("sem duplicatas de item entre grupos (invariante de negócio)", () => {
    const all = DEPT_GROUPS.flatMap((g) => g.items);
    const dupes = all.filter((x, i) => all.indexOf(x) !== i);
    expect(dupes).toEqual([]);
  });

  it("snapshot flat de departamentos detecta remoções acidentais", () => {
    expect(DEPT_GROUPS.flatMap((g) => g.items)).toMatchInlineSnapshot(`
      [
        "Compras",
        "Suprimentos",
        "Logística",
        "Operações",
        "Vendas",
        "Marketing",
        "Desenvolvimento de Negócios",
        "RH",
        "Diretoria",
        "Gerência",
        "Financeiro",
        "TI",
        "Controladoria",
        "Jurídico",
        "Engenharia",
        "Produto",
        "BI",
      ]
    `);
  });

  it("conformidade estrutural com o tipo DeptGroup", () => {
    const asType: DeptGroup[] = DEPT_GROUPS;
    expect(asType).toBe(DEPT_GROUPS);
  });
});
