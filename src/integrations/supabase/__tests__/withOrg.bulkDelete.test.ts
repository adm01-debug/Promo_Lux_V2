import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Garante que DELETE em massa em tabelas org-escopadas:
 *  1) Sempre injeta `.eq("organization_id", activeOrg)` ANTES das demais
 *     condições passadas pelo chamador (defesa em profundidade contra
 *     queries que esquecem o filtro de org).
 *  2) Bloqueia execução quando não há org ativa (falha fechado).
 *  3) Mantém o filtro de org intacto mesmo quando o chamador combina
 *     filtros (.in, .eq, .neq) que poderiam, sozinhos, abranger registros
 *     de outras orgs.
 */

type Call = { method: string; args: unknown[] };
const callOrder: Call[] = [];

function makeBuilder() {
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "in", "neq"] as const) {
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

import { db, setActiveOrgId, MissingOrgContextError } from "../withOrg";

const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";

function reset() {
  callOrder.length = 0;
  for (const m of Object.keys(builder)) {
    (builder[m] as unknown as { mockClear: () => void }).mockClear();
  }
}

describe("db (withOrg) — bulk DELETE scope guards", () => {
  beforeEach(() => {
    reset();
    setActiveOrgId(ORG_A);
  });

  it("injeta organization_id ANTES de filtros adicionais (.in)", () => {
    db.from("companies").delete().in("id", ["c1", "c2", "c3"]);

    const methods = callOrder.map((c) => c.method);
    // Ordem esperada: delete → eq(organization_id) → in(id, [...])
    expect(methods).toEqual(["delete", "eq", "in"]);

    const eqCall = callOrder.find((c) => c.method === "eq");
    expect(eqCall?.args).toEqual(["organization_id", ORG_A]);

    const inCall = callOrder.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["id", ["c1", "c2", "c3"]]);
  });

  it("injeta filtro de org mesmo quando chamador encadeia múltiplos .eq/.neq", () => {
    db.from("companies")
      .delete()
      .eq("starred", false)
      .neq("source", "manual");

    const eqCalls = callOrder.filter((c) => c.method === "eq");
    // O primeiro .eq deve ser o injetado pelo wrapper (organization_id).
    expect(eqCalls[0]?.args).toEqual(["organization_id", ORG_A]);
    // O .eq do chamador continua intacto.
    expect(eqCalls[1]?.args).toEqual(["starred", false]);

    const neqCall = callOrder.find((c) => c.method === "neq");
    expect(neqCall?.args).toEqual(["source", "manual"]);
  });

  it("bloqueia bulk delete quando não há org ativa (MissingOrgContextError)", () => {
    setActiveOrgId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("lux:active-org");
    }

    expect(() => db.from("companies").delete().in("id", ["a", "b"])).toThrow(
      MissingOrgContextError,
    );

    // O builder de delete não pode ser invocado quando faltam pré-requisitos.
    const deleteCalls = callOrder.filter((c) => c.method === "delete");
    expect(deleteCalls).toHaveLength(0);
  });

  it("aplica o filtro de org mesmo quando o chamador tenta divergir via .eq('organization_id', ORG_B)", () => {
    // O wrapper já injeta o filtro correto. Se o chamador adicionar um .eq
    // divergente, ambos serão enviados ao Postgrest — a interseção é vazia
    // e nenhum registro de outra org será afetado. O importante é garantir
    // que o filtro injetado pelo wrapper SEMPRE está presente.
    db.from("companies").delete().eq("organization_id", ORG_B).in("id", ["x"]);

    const eqCalls = callOrder.filter((c) => c.method === "eq");
    expect(eqCalls[0]?.args).toEqual(["organization_id", ORG_A]);
    // Também registra a tentativa divergente do chamador (não removida —
    // a interseção no servidor garante segurança).
    expect(eqCalls).toContainEqual(
      expect.objectContaining({ args: ["organization_id", ORG_B] }),
    );
  });

  it("cobre múltiplas tabelas escopadas (notifications, webhooks, deals)", () => {
    for (const table of ["notifications", "webhooks", "deals"] as const) {
      reset();
      db.from(table).delete().in("id", ["1", "2"]);
      const eqCall = callOrder.find((c) => c.method === "eq");
      expect(eqCall?.args, `tabela ${table}`).toEqual([
        "organization_id",
        ORG_A,
      ]);
    }
  });

  it("delete sem filtros adicionais ainda recebe o eq de org", () => {
    db.from("companies").delete();
    const methods = callOrder.map((c) => c.method);
    expect(methods).toEqual(["delete", "eq"]);
    expect(callOrder[1].args).toEqual(["organization_id", ORG_A]);
  });
});
