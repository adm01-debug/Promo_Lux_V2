import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import {
  PII_ACTION_LABEL,
  PII_CATEGORY_LABEL,
  regrasAtivasPii,
  resumoMascaramentoPii,
  type PiiRule,
} from "../usePiiRules";

const REGRAS: PiiRule[] = [
  { category: "email", action: "mask", enabled: true },
  { category: "cpf", action: "hash", enabled: true },
  { category: "phone", action: "mask", enabled: false },
];

describe("regrasAtivasPii", () => {
  it("devolve lista vazia quando o hook ainda nao carregou", () => {
    expect(regrasAtivasPii(undefined)).toEqual([]);
    expect(regrasAtivasPii(null)).toEqual([]);
    expect(regrasAtivasPii([])).toEqual([]);
  });

  it("descarta regra desligada: so ela nao muda o arquivo exportado", () => {
    const ativas = regrasAtivasPii(REGRAS);
    expect(ativas.map((r) => r.category)).toEqual(["email", "cpf"]);
  });
});

describe("resumoMascaramentoPii", () => {
  it("devolve string vazia sem regra ligada (nenhum efeito no export)", () => {
    expect(resumoMascaramentoPii(undefined)).toBe("");
    expect(resumoMascaramentoPii([{ category: "email", action: "mask", enabled: false }])).toBe("");
  });

  it("conta as regras ligadas e traduz categoria e acao", () => {
    const texto = resumoMascaramentoPii(REGRAS);
    expect(texto).toContain("2 regra(s) ativa(s)");
    expect(texto).toContain(PII_ACTION_LABEL.mask.toLowerCase());
    expect(texto).toContain(PII_ACTION_LABEL.hash.toLowerCase());
    expect(texto).toContain(PII_CATEGORY_LABEL.email);
    expect(texto).toContain(PII_CATEGORY_LABEL.cpf);
    expect(texto).not.toContain(PII_CATEGORY_LABEL.phone);
  });

  it("nao repete a mesma acao quando varias categorias usam a mesma", () => {
    const texto = resumoMascaramentoPii([
      { category: "email", action: "mask", enabled: true },
      { category: "phone", action: "mask", enabled: true },
    ]);
    expect(texto.match(/mascarar/g)?.length).toBe(1);
  });

  it("cai para o valor cru quando a acao ou categoria e desconhecida", () => {
    const texto = resumoMascaramentoPii([
      { category: "passport" as PiiRule["category"], action: "bleach" as PiiRule["action"], enabled: true },
    ]);
    expect(texto).toContain("bleach");
    expect(texto).toContain("passport");
  });
});