import { describe, it, expect } from "vitest";
import {
  DEPT_MAP,
  SUGGESTED_DEPARTMENTS_PT,
  resolveDepartments,
  findPtLabelForEn,
} from "../departmentMap.data";

describe("departmentMap — fonte de verdade compartilhada", () => {
  it("congela DEPT_MAP e sugestões (imutabilidade)", () => {
    expect(Object.isFrozen(DEPT_MAP)).toBe(true);
    expect(Object.isFrozen(SUGGESTED_DEPARTMENTS_PT)).toBe(true);
  });

  it("mantém pelo menos 12 sugestões PT sem duplicatas", () => {
    expect(SUGGESTED_DEPARTMENTS_PT.length).toBeGreaterThanOrEqual(12);
    const set = new Set(SUGGESTED_DEPARTMENTS_PT.map((s) => s.toLowerCase()));
    expect(set.size).toBe(SUGGESTED_DEPARTMENTS_PT.length);
  });

  it("mapeia todas as sugestões PT canônicas para um enum EN válido", () => {
    const validEn = new Set(Object.values(DEPT_MAP));
    for (const pt of SUGGESTED_DEPARTMENTS_PT) {
      const en = DEPT_MAP[pt.toLowerCase()];
      expect(en, `sugestão "${pt}" deve estar no DEPT_MAP`).toBeTruthy();
      expect(validEn.has(en!)).toBe(true);
    }
  });

  describe("resolveDepartments", () => {
    it("normaliza case, acentos e whitespace", () => {
      const r = resolveDepartments(["  Compras ", "MARKETING", "rh", "TI"]);
      expect(r.mapped).toEqual([
        "Operations",
        "Marketing",
        "Human Resources",
        "Information Technology",
      ]);
      expect(r.notFound).toEqual([]);
    });

    it("deduplica enums EN preservando ordem de primeira aparição", () => {
      const r = resolveDepartments(["compras", "suprimentos", "logística", "estoque"]);
      expect(r.mapped).toEqual(["Operations"]);
      expect(r.notFound).toEqual([]);
    });

    it("separa mapeados de não mapeados sem lançar", () => {
      const r = resolveDepartments(["vendas", "xpto", "marketing", ""]);
      expect(r.mapped).toEqual(["Business Development", "Marketing"]);
      expect(r.notFound).toEqual(["xpto"]);
    });

    it("é idempotente: aplicar duas vezes o mesmo input produz o mesmo output", () => {
      const input = ["compras", "rh", "financeiro", "ti"];
      expect(resolveDepartments(input)).toEqual(resolveDepartments([...input]));
    });

    it("suporta variantes com/sem acento (compra vs. compras, rh vs. RH)", () => {
      expect(resolveDepartments(["operações"]).mapped).toEqual(["Operations"]);
      expect(resolveDepartments(["operacoes"]).mapped).toEqual(["Operations"]);
      expect(resolveDepartments(["Jurídico"]).mapped).toEqual(["Legal"]);
      expect(resolveDepartments(["juridico"]).mapped).toEqual(["Legal"]);
    });

    it("array vazio → mapped e notFound vazios", () => {
      expect(resolveDepartments([])).toEqual({ mapped: [], notFound: [] });
    });

    it("simulação massiva: 200 combinações aleatórias mantêm invariantes", () => {
      const keys = Object.keys(DEPT_MAP);
      const rand = (n: number) => Math.floor(Math.random() * n);
      for (let i = 0; i < 200; i++) {
        const size = 1 + rand(8);
        const sample = Array.from({ length: size }, () => keys[rand(keys.length)]);
        const noise = i % 3 === 0 ? [...sample, "gibberish_" + i] : sample;
        const r = resolveDepartments(noise);
        // Invariante 1: mapped ⊆ Set(valores DEPT_MAP)
        const validEn = new Set(Object.values(DEPT_MAP));
        r.mapped.forEach((en) => expect(validEn.has(en)).toBe(true));
        // Invariante 2: sem duplicatas em mapped
        expect(new Set(r.mapped).size).toBe(r.mapped.length);
        // Invariante 3: notFound tem apenas o ruído (quando presente)
        if (i % 3 === 0) expect(r.notFound).toContain("gibberish_" + i);
      }
    });
  });

  describe("findPtLabelForEn", () => {
    it("retorna o label PT original quando encontrado", () => {
      expect(findPtLabelForEn("Marketing", ["Marketing", "TI"])).toBe("Marketing");
      expect(findPtLabelForEn("Human Resources", ["rh"])).toBe("rh");
    });

    it("faz fallback para o enum EN quando não encontra", () => {
      expect(findPtLabelForEn("Legal", ["vendas"])).toBe("Legal");
      expect(findPtLabelForEn("Marketing", [])).toBe("Marketing");
    });
  });
});
