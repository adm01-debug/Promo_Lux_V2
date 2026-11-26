import { beforeEach, describe, it, expect } from "vitest";
import {
  FAIL_OPEN_TOLERANCE_MS,
  noteRateLimitSuccess,
  parseRateLimitDecision,
  resetRateLimitTolerance,
  retryAfterSeconds,
  withinFailOpenTolerance,
} from "../api-rate-limit.ts";

describe("parseRateLimitDecision", () => {
  it("aprova quando a RPC devolve allowed=true", () => {
    expect(parseRateLimitDecision([{ allowed: true, current_count: 3, reset_at: "2026-11-21T13:00:00Z" }]))
      .toEqual({ allowed: true, currentCount: 3, resetAt: "2026-11-21T13:00:00Z", available: true });
  });

  it("bloqueia quando a RPC devolve allowed=false", () => {
    expect(parseRateLimitDecision([{ allowed: false, current_count: 600, reset_at: "2026-11-21T13:00:00Z" }]).allowed)
      .toBe(false);
  });

  it("marca indisponivel (e nao 'permitido') em resposta vazia/nula", () => {
    const esperado = { allowed: false, currentCount: null, resetAt: null, available: false };
    expect(parseRateLimitDecision(null)).toEqual(esperado);
    expect(parseRateLimitDecision([])).toEqual(esperado);
    expect(parseRateLimitDecision("boom")).toEqual(esperado);
    expect(parseRateLimitDecision([{ current_count: 7 }])).toEqual(esperado);
    expect(parseRateLimitDecision([{ allowed: null }])).toEqual(esperado);
  });

  it("trata objeto unico e array de uma linha da mesma forma", () => {
    const obj = { allowed: true, current_count: 1, reset_at: "x" };
    expect(parseRateLimitDecision(obj)).toEqual(parseRateLimitDecision([obj]));
  });
});

describe("retryAfterSeconds", () => {
  it("usa resetAt futuro e nunca devolve 0", () => {
    const later = new Date(Date.now() + 90_000).toISOString();
    expect(Number(retryAfterSeconds(later))).toBeGreaterThan(0);
  });

  it("fallback de 1h sem reset_at", () => {
    expect(retryAfterSeconds(null)).toBe("3600");
  });
});

describe("tolerancia de fail-open (etapa 038)", () => {
  beforeEach(() => resetRateLimitTolerance());

  it("sem contagem bem-sucedida nao ha tolerancia", () => {
    expect(withinFailOpenTolerance()).toBe(false);
  });

  it("tolera falha dentro de 60 s da ultima contagem boa", () => {
    noteRateLimitSuccess(1_000);
    expect(withinFailOpenTolerance(1_000 + FAIL_OPEN_TOLERANCE_MS - 1)).toBe(true);
  });

  it("deixa de tolerar depois de 60 s", () => {
    noteRateLimitSuccess(1_000);
    expect(withinFailOpenTolerance(1_000 + FAIL_OPEN_TOLERANCE_MS)).toBe(false);
  });

  it("reset volta ao estado sem tolerancia", () => {
    noteRateLimitSuccess(5_000);
    resetRateLimitTolerance();
    expect(withinFailOpenTolerance(5_001)).toBe(false);
  });
});