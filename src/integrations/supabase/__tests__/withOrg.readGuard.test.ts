import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Guarda de leitura da etapa 010: sem organizacao ativa, nenhum `select` em
 * tabela org-escopada pode sair. Antes desta guarda o wrapper so avisava no
 * console e devolvia a consulta sem `.eq("organization_id", ...)`, deixando o
 * isolamento por conta da RLS.
 */

const calls: Record<string, unknown[]> = { select: [], eq: [], is: [], order: [] };

function makeBuilder() {
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["select", "eq", "is", "order", "limit"] as const) {
    b[m] = vi.fn((...args: unknown[]) => {
      (calls[m] ??= []).push(args);
      return b;
    });
  }
  return b;
}

const builder = makeBuilder();

vi.mock("../client", () => ({
  supabase: { from: () => builder },
}));

import {
  db,
  setActiveOrgId,
  setOrgErrorListener,
  MissingOrgContextError,
} from "../withOrg";

const ORG = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  for (const key of Object.keys(calls)) calls[key].length = 0;
  for (const m of Object.keys(builder)) {
    (builder[m] as unknown as { mockClear: () => void }).mockClear();
  }
  setActiveOrgId(null);
  setOrgErrorListener(null);
});

describe("withOrg - leitura sem organizacao ativa", () => {
  it("lanca MissingOrgContextError no select em tabela org-escopada", () => {
    expect(() => db.from("companies").select("*")).toThrowError(MissingOrgContextError);
    try {
      db.from("companies").select("*");
    } catch (err) {
      const e = err as MissingOrgContextError;
      expect(e.table).toBe("companies");
      expect(e.op).toBe("select");
      expect(e.message).toMatch(/nenhuma organiza/);
    }
  });

  it("nao chega a montar a consulta no cliente", () => {
    expect(() => db.from("workflows").select("*")).toThrow();
    expect(builder.select).not.toHaveBeenCalled();
  });

  it("avisa o handler global antes de lancar", () => {
    const listener = vi.fn();
    setOrgErrorListener(listener);
    expect(() => db.from("intent_signals").select("*")).toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as MissingOrgContextError).op).toBe("select");
  });

  it("com organizacao ativa, filtra pela org e esconde a lixeira", () => {
    setActiveOrgId(ORG);
    db.from("companies").select("*");
    const eqArgs = calls.eq.map((c) => c as unknown[]);
    expect(eqArgs).toContainEqual(["organization_id", ORG]);
    expect(calls.is.map((c) => c as unknown[])).toContainEqual(["deleted_at", null]);
  });

  it("tabela isenta continua legivel sem organizacao", () => {
    expect(() => db.from("changelog_entries").select("*")).not.toThrow();
    expect(calls.eq).toHaveLength(0);
  });

  it("volta a lancar depois de limpar a organizacao ativa", () => {
    setActiveOrgId(ORG);
    expect(() => db.from("deals").select("*")).not.toThrow();
    setActiveOrgId(null);
    expect(() => db.from("deals").select("*")).toThrowError(MissingOrgContextError);
  });
});