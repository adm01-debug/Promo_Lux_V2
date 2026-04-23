import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Testes de payloads maliciosos que tentam burlar o escopo multi-tenant
 * via combinações de filtros (in/or/eq/neq/match/filter), reordenação de
 * chamadas e mutações de organization_id no payload de update.
 *
 * Verifica que o wrapper SEMPRE injeta `.eq("organization_id", activeOrg)`
 * ANTES de devolver o builder ao chamador, de forma que qualquer filtro
 * extra do atacante atua dentro da interseção da org ativa.
 */

type Call = { method: string; args: unknown[] };
const callOrder: Call[] = [];

const METHODS = [
  "select",
  "insert",
  "upsert",
  "update",
  "delete",
  "eq",
  "in",
  "or",
  "neq",
  "match",
  "filter",
  "not",
] as const;

function makeBuilder() {
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of METHODS) {
    b[m] = vi.fn((...args: unknown[]) => {
      callOrder.push({ method: m, args });
      return b;
    });
  }
  return b;
}

const builder = makeBuilder();

vi.mock("../client", () => ({
  supabase: { from: vi.fn(() => builder) },
}));

import {
  db,
  setActiveOrgId,
  OrgMismatchError,
  MissingOrgContextError,
} from "../withOrg";

const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";

function reset() {
  callOrder.length = 0;
  for (const m of Object.keys(builder)) {
    (builder[m] as unknown as { mockClear: () => void }).mockClear();
  }
}

function orgEqCalls() {
  return callOrder.filter(
    (c) => c.method === "eq" && c.args[0] === "organization_id",
  );
}

describe("db (withOrg) — malicious payloads & filter bypass attempts", () => {
  beforeEach(() => {
    reset();
    setActiveOrgId(ORG_A);
  });

  describe("UPDATE — tentativas de mover registro para outra org", () => {
    it("bloqueia update com organization_id divergente no payload (singular)", () => {
      expect(() =>
        db.from("companies").update({ name: "x", organization_id: ORG_B }),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "update")).toBeUndefined();
    });

    it("bloqueia update com organization_id divergente em array (bulk)", () => {
      // O builder de update do Supabase aceita objeto único, mas o wrapper
      // também valida arrays para defesa em profundidade.
      expect(() =>
        db.from("companies").update([
          { name: "ok", organization_id: ORG_A },
          { name: "evil", organization_id: ORG_B },
        ] as unknown as Record<string, unknown>),
      ).toThrow(OrgMismatchError);
    });

    it("remove organization_id do payload mesmo combinando com .in/.or", () => {
      db.from("companies")
        .update({ name: "renamed", organization_id: ORG_A })
        .in("id", ["a", "b"])
        .or("starred.eq.true,enriched.eq.true");

      const updateCall = callOrder.find((c) => c.method === "update");
      expect(updateCall?.args).toEqual([{ name: "renamed" }]);

      // O .eq de org SEMPRE precede os filtros do chamador.
      const methods = callOrder.map((c) => c.method);
      const orgIdx = methods.indexOf("eq");
      const inIdx = methods.indexOf("in");
      const orIdx = methods.indexOf("or");
      expect(orgIdx).toBeLessThan(inIdx);
      expect(orgIdx).toBeLessThan(orIdx);
      expect(orgEqCalls()[0]?.args).toEqual(["organization_id", ORG_A]);
    });

    it("payload com organization_id null não é tratado como bypass (nullish ignorado)", () => {
      // organization_id=null/undefined no payload não deve disparar
      // OrgMismatch; apenas é removido no strip do update.
      db.from("companies").update({
        name: "x",
        organization_id: null,
      } as unknown as Record<string, unknown>);
      const updateCall = callOrder.find((c) => c.method === "update");
      expect(updateCall?.args).toEqual([{ name: "x" }]);
      expect(orgEqCalls()[0]?.args).toEqual(["organization_id", ORG_A]);
    });
  });

  describe("DELETE — filtros combinados não removem o escopo", () => {
    it("delete com .or() ainda recebe .eq(organization_id) injetado primeiro", () => {
      db.from("companies").delete().or("starred.eq.false,enriched.eq.false");

      const methods = callOrder.map((c) => c.method);
      expect(methods[0]).toBe("delete");
      expect(methods[1]).toBe("eq");
      expect(callOrder[1].args).toEqual(["organization_id", ORG_A]);
      expect(methods).toContain("or");
    });

    it("delete com .match() arbitrário não substitui filtro de org", () => {
      db.from("companies").delete().match({ source: "manual" });
      expect(orgEqCalls()).toHaveLength(1);
      expect(callOrder.find((c) => c.method === "match")?.args).toEqual([
        { source: "manual" },
      ]);
    });

    it("delete com .filter('organization_id','eq', ORG_B) coexiste com filtro forçado da org ativa", () => {
      // O atacante adiciona um filtro divergente; o wrapper já injetou o
      // filtro correto. A interseção no Postgrest é vazia → seguro.
      db.from("companies").delete().filter("organization_id", "eq", ORG_B);

      expect(orgEqCalls()[0]?.args).toEqual(["organization_id", ORG_A]);
      const filterCall = callOrder.find((c) => c.method === "filter");
      expect(filterCall?.args).toEqual(["organization_id", "eq", ORG_B]);
    });

    it("delete com .not('organization_id','eq', ORG_A) ainda recebe o eq positivo da org", () => {
      // Tentativa explícita de excluir a org ativa do escopo. O wrapper
      // garante que o .eq positivo está presente — interseção vazia.
      db.from("companies").delete().not("organization_id", "eq", ORG_A);

      expect(orgEqCalls()[0]?.args).toEqual(["organization_id", ORG_A]);
      const notCall = callOrder.find((c) => c.method === "not");
      expect(notCall?.args).toEqual(["organization_id", "eq", ORG_A]);
    });
  });

  describe("INSERT/UPSERT — bulk mistos com payload malicioso", () => {
    it("upsert em bulk com uma linha de outra org bloqueia tudo", () => {
      expect(() =>
        db
          .from("companies")
          .upsert([
            { name: "ok1" },
            { name: "ok2", organization_id: ORG_A },
            { name: "evil", organization_id: ORG_B },
          ]),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "upsert")).toBeUndefined();
    });

    it("insert em bulk sem org ativa falha fechado mesmo com payload 'limpo'", () => {
      setActiveOrgId(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("lux:active-org");
      }
      expect(() =>
        db.from("companies").insert([{ name: "a" }, { name: "b" }]),
      ).toThrow(MissingOrgContextError);
      expect(callOrder.find((c) => c.method === "insert")).toBeUndefined();
    });

    it("insert preenche org ausente em todas as linhas do bulk", () => {
      db.from("companies").insert([
        { name: "a" },
        { name: "b", organization_id: ORG_A },
      ]);
      const insertCall = callOrder.find((c) => c.method === "insert");
      expect(insertCall?.args[0]).toEqual([
        { name: "a", organization_id: ORG_A },
        { name: "b", organization_id: ORG_A },
      ]);
    });
  });

  describe("SELECT — filtros adicionais não removem o escopo automático", () => {
    it("select().or().in() preserva o eq de org como primeiro filtro", () => {
      db.from("companies")
        .select("id, name")
        .or("starred.eq.true,enriched.eq.true")
        .in("id", ["a", "b"]);

      const methods = callOrder.map((c) => c.method);
      // select primeiro, depois o eq injetado pelo wrapper, depois os filtros do chamador.
      expect(methods[0]).toBe("select");
      expect(methods[1]).toBe("eq");
      expect(callOrder[1].args).toEqual(["organization_id", ORG_A]);
      expect(methods).toContain("or");
      expect(methods).toContain("in");
    });

    it("chamador não consegue 'sobrescrever' o eq injetado adicionando outro eq divergente", () => {
      db.from("companies").select("*").eq("organization_id", ORG_B);
      const eqs = orgEqCalls().map((c) => c.args);
      // Ambos chegam ao Postgrest; a interseção (ORG_A ∩ ORG_B) é vazia.
      expect(eqs[0]).toEqual(["organization_id", ORG_A]);
      expect(eqs).toContainEqual(["organization_id", ORG_B]);
    });
  });
});
