import { describe, it, expect, beforeEach, vi } from "vitest";

// Capturamos as chamadas feitas no builder para inspeção.
const calls: Record<string, unknown[]> = { select: [], insert: [], upsert: [], update: [], delete: [], eq: [] };

function makeBuilder() {
  // Builder fluente que registra chamadas e devolve sempre a si mesmo.
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["select", "insert", "upsert", "update", "delete", "eq"] as const) {
    b[m] = vi.fn((...args: unknown[]) => {
      calls[m].push(args);
      return b;
    });
  }
  return b;
}

const builder = makeBuilder();

vi.mock("../client", () => ({
  supabase: {
    from: vi.fn(() => builder),
  },
}));

import { db, setActiveOrgId, ensureSameOrg, OrgMismatchError, MissingOrgContextError } from "../withOrg";

const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";

function reset() {
  for (const k of Object.keys(calls)) calls[k].length = 0;
  for (const m of Object.keys(builder)) (builder[m] as unknown as { mockClear: () => void }).mockClear();
}

describe("db (withOrg) — multi-tenant guards", () => {
  beforeEach(() => {
    reset();
    setActiveOrgId(ORG_A);
  });

  describe("SELECT auto-scoping", () => {
    it("aplica .eq('organization_id', activeOrg) em tabelas escopadas", () => {
      db.from("companies").select("*");
      expect(calls.select).toEqual([["*"]]);
      expect(calls.eq).toEqual([["organization_id", ORG_A]]);
    });

    it("não aplica filtro em tabelas fora do escopo (profiles)", () => {
      db.from("profiles").select("id, full_name");
      expect(calls.select).toEqual([["id, full_name"]]);
      expect(calls.eq).toEqual([]);
    });

    it("não aplica filtro quando não há org ativa", () => {
      setActiveOrgId(null);
      // limpa o fallback do localStorage também
      if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
      db.from("companies").select("*");
      expect(calls.eq).toEqual([]);
    });
  });

  describe("INSERT/UPSERT injeção e bloqueio cross-org", () => {
    it("injeta organization_id da org ativa quando ausente", () => {
      db.from("companies").insert({ name: "Acme" });
      expect(calls.insert[0]).toEqual([{ name: "Acme", organization_id: ORG_A }]);
    });

    it("aceita payload com mesma org explícita", () => {
      db.from("companies").insert({ name: "Acme", organization_id: ORG_A });
      expect(calls.insert[0]).toEqual([{ name: "Acme", organization_id: ORG_A }]);
    });

    it("lança OrgMismatchError em insert com outra org", () => {
      expect(() =>
        db.from("companies").insert({ name: "Hack", organization_id: ORG_B }),
      ).toThrow(OrgMismatchError);
      expect(calls.insert).toEqual([]);
    });

    it("bloqueia mesmo dentro de array (bulk)", () => {
      expect(() =>
        db.from("companies").insert([
          { name: "ok" },
          { name: "bad", organization_id: ORG_B },
        ]),
      ).toThrow(OrgMismatchError);
    });

    it("lança OrgMismatchError em UPSERT com outra org (e não chama builder)", () => {
      expect(() =>
        db.from("companies").upsert({ id: "x", name: "Hack", organization_id: ORG_B }),
      ).toThrow(OrgMismatchError);
      expect(calls.upsert).toEqual([]);
    });

    it("upsert injeta organization_id quando ausente", () => {
      db.from("companies").upsert({ id: "x", name: "Acme" });
      expect(calls.upsert[0]).toEqual([{ id: "x", name: "Acme", organization_id: ORG_A }]);
    });

    it("OrgMismatchError carrega contexto útil (table, op, expected, got)", () => {
      try {
        db.from("deals").insert({ title: "x", organization_id: ORG_B });
        throw new Error("deveria ter lançado");
      } catch (err) {
        expect(err).toBeInstanceOf(OrgMismatchError);
        const e = err as OrgMismatchError;
        expect(e.table).toBe("deals");
        expect(e.op).toBe("insert");
        expect(e.expected).toBe(ORG_A);
        expect(e.got).toBe(ORG_B);
      }
    });

    it("bloqueia DELETE — com outra org no payload via .eq não é interceptado, mas filtro de org é forçado", () => {
      // delete não recebe payload; o que importa é que .eq('organization_id', ORG_A) é sempre injetado
      db.from("companies").delete().eq("id", "abc");
      expect(calls.eq).toContainEqual(["organization_id", ORG_A]);
    });

    it("cobre múltiplas tabelas escopadas (deals, stakeholders, campaigns)", () => {
      for (const t of ["deals", "stakeholders", "campaigns"] as const) {
        reset();
        expect(() =>
          db.from(t).insert({ name: "x", title: "x", full_name: "x", organization_id: ORG_B } as never),
        ).toThrow(OrgMismatchError);
        expect(calls.insert).toEqual([]);
      }
    });
  });

  describe("UPDATE força escopo", () => {
    it("anexa .eq('organization_id', activeOrg) automaticamente", () => {
      db.from("companies").update({ name: "renamed" });
      expect(calls.update[0]).toEqual([{ name: "renamed" }]);
      expect(calls.eq).toEqual([["organization_id", ORG_A]]);
    });

    it("bloqueia update tentando setar organization_id de outra org", () => {
      expect(() =>
        db.from("companies").update({ organization_id: ORG_B }),
      ).toThrow(OrgMismatchError);
    });

    it("strip organization_id do payload mesmo quando bate com a org ativa", () => {
      db.from("companies").update({ name: "x", organization_id: ORG_A });
      // organization_id NÃO deve ir no payload de update
      expect(calls.update[0]).toEqual([{ name: "x" }]);
      expect(calls.eq).toEqual([["organization_id", ORG_A]]);
    });

    it("falha fechado se não houver org ativa em UPDATE", () => {
      setActiveOrgId(null);
      if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
      expect(() => db.from("companies").update({ name: "x" })).toThrow(MissingOrgContextError);
      expect(calls.update).toEqual([]);
    });
  });

  describe("DELETE força escopo", () => {
    it("anexa filtro de organização", () => {
      db.from("companies").delete();
      expect(calls.delete[0]).toEqual([]);
      expect(calls.eq).toEqual([["organization_id", ORG_A]]);
    });

    it("falha fechado se não houver org ativa em DELETE", () => {
      setActiveOrgId(null);
      if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
      expect(() => db.from("companies").delete()).toThrow(MissingOrgContextError);
      expect(calls.delete).toEqual([]);
    });
  });

  describe("INSERT falha fechado sem org", () => {
    it("lança MissingOrgContextError em insert sem org ativa", () => {
      setActiveOrgId(null);
      if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
      expect(() => db.from("companies").insert({ name: "x" })).toThrow(MissingOrgContextError);
      expect(calls.insert).toEqual([]);
    });

    it("permite insert em tabela fora do escopo mesmo sem org", () => {
      setActiveOrgId(null);
      if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
      db.from("profiles").insert({ id: "u1", full_name: "X" });
      expect(calls.insert[0]).toEqual([{ id: "u1", full_name: "X" }]);
    });
  });

  describe("ensureSameOrg helper", () => {
    it("retorna true quando a org bate", () => {
      expect(ensureSameOrg({ organization_id: ORG_A })).toBe(true);
    });
    it("retorna false em outra org", () => {
      expect(ensureSameOrg({ organization_id: ORG_B })).toBe(false);
    });
    it("retorna false sem registro", () => {
      expect(ensureSameOrg(null)).toBe(false);
    });
  });
});
