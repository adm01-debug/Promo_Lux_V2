import { describe, it, expect } from "vitest";
import { computeBitrixReadiness, formatPushResumo } from "../oracleV2Helpers";
import type { PushBitrixResponse } from "../useOracleV2";

describe("computeBitrixReadiness", () => {
  it("marca pronto quando company_id e user_id numérico estão preenchidos", () => {
    const r = computeBitrixReadiness("42", "7");
    expect(r).toEqual({ pronto: true, motivoBloqueio: null });
  });

  it("bloqueia quando company_id vazio", () => {
    const r = computeBitrixReadiness("  ", "7");
    expect(r.pronto).toBe(false);
    expect(r.motivoBloqueio).toContain("ID da empresa");
  });

  it("bloqueia quando user_id vazio", () => {
    const r = computeBitrixReadiness("42", "");
    expect(r.pronto).toBe(false);
    expect(r.motivoBloqueio).toContain("ID do responsável");
  });

  it("bloqueia quando user_id não é numérico", () => {
    const r = computeBitrixReadiness("42", "abc");
    expect(r.pronto).toBe(false);
    expect(r.motivoBloqueio).toContain("numérico");
  });
});

function makeResponse(
  summary: Partial<PushBitrixResponse["summary"]> = {},
  correlation_id = "abcdef12-3456-7890",
): PushBitrixResponse {
  return {
    results: [],
    summary: {
      sent: 0,
      duplicates: 0,
      errors: 0,
      sem_dado: 0,
      skipped: 0,
      ...summary,
    },
    skipped: [],
    correlation_id,
  };
}

describe("formatPushResumo", () => {
  it("success quando sent>0 e sem erros, com prefixo do correlation_id", () => {
    const r = formatPushResumo(makeResponse({ sent: 3 }));
    expect(r.tone).toBe("success");
    expect(r.mensagem).toContain("3 cadastrado(s)");
    expect(r.mensagem).toContain("abcdef12");
  });

  it("error quando errors>0 e sent=0", () => {
    const r = formatPushResumo(makeResponse({ errors: 2 }));
    expect(r.tone).toBe("error");
    expect(r.mensagem).toMatch(/falhou/i);
    expect(r.mensagem).toContain("2 com erro");
  });

  it("warning quando parcial (errors>0 + sent>0)", () => {
    const r = formatPushResumo(makeResponse({ sent: 1, errors: 1 }));
    expect(r.tone).toBe("warning");
    expect(r.mensagem).toContain("1 cadastrado(s)");
    expect(r.mensagem).toContain("1 com erro");
  });

  it("mostra 'nada a enviar' quando summary vazio", () => {
    const r = formatPushResumo(makeResponse({}));
    expect(r.mensagem).toContain("nada a enviar");
    expect(r.tone).toBe("success");
  });
});
