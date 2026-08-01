import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Garante que chamadas em lote (insert/upsert com array de N registros)
 * onde QUALQUER linha aponta para outra org bloqueiam a operação inteira
 * com OrgMismatchError. Nenhuma linha pode ser parcialmente persistida.
 */

type Call = { method: string; args: unknown[] };
const callOrder: Call[] = [];

function makeBuilder() {
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of [
    "select",
    "insert",
    "upsert",
    "update",
    "delete",
    "eq",
    "in",
  ] as const) {
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

import { db, setActiveOrgId, OrgMismatchError } from "../withOrg";

const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";
const ORG_C = "00000000-0000-0000-0000-0000000000cc";

function reset() {
  callOrder.length = 0;
  for (const m of Object.keys(builder)) {
    (builder[m] as unknown as { mockClear: () => void }).mockClear();
  }
}

describe("db (withOrg) — batch operations atomic rejection", () => {
  beforeEach(() => {
    reset();
    setActiveOrgId(ORG_A);
  });

  describe("INSERT em lote", () => {
    it("falha o lote inteiro quando a última linha é de outra org", () => {
      expect(() =>
        db.from("companies").insert([
          { name: "row1" },
          { name: "row2", organization_id: ORG_A },
          { name: "row3-evil", organization_id: ORG_B },
        ]),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "insert")).toBeUndefined();
    });

    it("falha o lote inteiro quando a primeira linha é de outra org", () => {
      expect(() =>
        db.from("companies").insert([
          { name: "row1-evil", organization_id: ORG_B },
          { name: "row2" },
          { name: "row3" },
        ]),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "insert")).toBeUndefined();
    });

    it("falha o lote inteiro quando duas orgs distintas aparecem", () => {
      expect(() =>
        db.from("companies").insert([
          { name: "a", organization_id: ORG_B },
          { name: "b", organization_id: ORG_C },
        ]),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "insert")).toBeUndefined();
    });

    it("erro carrega contexto da primeira linha divergente", () => {
      try {
        db.from("companies").insert([
          { name: "ok" },
          { name: "evil", organization_id: ORG_B },
        ]);
        throw new Error("deveria ter lançado");
      } catch (err) {
        expect(err).toBeInstanceOf(OrgMismatchError);
        const e = err as OrgMismatchError;
        expect(e.table).toBe("companies");
        expect(e.op).toBe("insert");
        expect(e.expected).toBe(ORG_A);
        expect(e.got).toBe(ORG_B);
      }
    });

    it("aceita lote 100% válido (todos da org ativa)", () => {
      db.from("companies").insert([
        { name: "a" },
        { name: "b", organization_id: ORG_A },
        { name: "c" },
      ]);
      const insertCall = callOrder.find((c) => c.method === "insert");
      expect(insertCall?.args[0]).toEqual([
        { name: "a", organization_id: ORG_A },
        { name: "b", organization_id: ORG_A },
        { name: "c", organization_id: ORG_A },
      ]);
    });

    it("lote vazio não dispara erro nem chama o builder com lixo", () => {
      db.from("companies").insert([]);
      const insertCall = callOrder.find((c) => c.method === "insert");
      // Wrapper apenas repassa o array vazio; sem injeção de org necessária.
      expect(insertCall?.args[0]).toEqual([]);
    });
  });

  describe("UPSERT em lote", () => {
    it("falha o lote inteiro quando uma linha é de outra org", () => {
      expect(() =>
        db.from("companies").upsert([
          { id: "1", name: "ok1" },
          { id: "2", name: "ok2", organization_id: ORG_A },
          { id: "3", name: "evil", organization_id: ORG_B },
        ]),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "upsert")).toBeUndefined();
    });

    it("preserva options (segundo argumento) quando lote válido", () => {
      db.from("companies").upsert([{ name: "a" }, { name: "b" }], {
        onConflict: "id",
      });
      const upsertCall = callOrder.find((c) => c.method === "upsert");
      expect(upsertCall?.args[0]).toEqual([
        { name: "a", organization_id: ORG_A },
        { name: "b", organization_id: ORG_A },
      ]);
      expect(upsertCall?.args[1]).toEqual({ onConflict: "id" });
    });
  });

  describe("UPDATE em lote (array payload)", () => {
    // O cliente Supabase aceita objeto único em update, mas a defesa em
    // profundidade do wrapper também valida arrays — útil quando código
    // genérico passa um payload bulk por engano.
    it("falha update array com linha de outra org", () => {
      expect(() =>
        db.from("companies").update([
          { name: "ok", organization_id: ORG_A },
          { name: "evil", organization_id: ORG_B },
        ] as unknown as Record<string, unknown>),
      ).toThrow(OrgMismatchError);
      expect(callOrder.find((c) => c.method === "update")).toBeUndefined();
    });

    it("strip organization_id de cada linha quando array é válido", () => {
      db.from("companies").update([
        { name: "a", organization_id: ORG_A },
        { name: "b" },
      ] as unknown as Record<string, unknown>);

      const updateCall = callOrder.find((c) => c.method === "update");
      expect(updateCall?.args[0]).toEqual([{ name: "a" }, { name: "b" }]);
    });
  });

  describe("Cobertura cross-tabela", () => {
    it.each(["companies", "notifications", "deals", "webhooks"] as const)(
      "lote em '%s' falha quando uma linha é de outra org",
      (table) => {
        reset();
        const rows: Record<string, unknown>[] =
          table === "notifications"
            ? [
                { title: "a", message: "b" },
                { title: "c", message: "d", organization_id: ORG_B },
              ]
            : table === "webhooks"
              ? [
                  { name: "a", url: "https://a" },
                  { name: "b", url: "https://b", organization_id: ORG_B },
                ]
              : [
                  { name: "a" },
                  { name: "b", organization_id: ORG_B },
                ];

        expect(() =>
          // Wrapper aplica as mesmas regras a todas as tabelas escopadas.
          (db.from(table) as unknown as { insert: (v: unknown) => unknown }).insert(rows),
        ).toThrow(OrgMismatchError);
      },
    );
  });
});
