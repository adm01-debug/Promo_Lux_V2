import { describe, it, expect } from "vitest";
import {
  buildApolloCacheKey,
  ttlForResult,
  cooldownForStatus,
  parseRateDecision,
  APOLLO_CACHE_TTL_HIT_SECONDS,
  APOLLO_CACHE_TTL_EMPTY_SECONDS,
  APOLLO_COOLDOWN_FORBIDDEN_SECONDS,
  APOLLO_COOLDOWN_RATE_LIMIT_SECONDS,
} from "../apollo-cache.ts";

describe("buildApolloCacheKey", () => {
  it("é estável independente da ordem dos filtros", () => {
    const a = buildApolloCacheKey({
      domain: "acme.com",
      titles: ["CFO", "Diretor Financeiro"],
      departments: ["finance", "accounting"],
      size: 25,
    });
    const b = buildApolloCacheKey({
      domain: "acme.com",
      titles: ["Diretor Financeiro", "CFO"],
      departments: ["accounting", "finance"],
      size: 25,
    });
    expect(a).toBe(b);
  });

  it("normaliza caixa do domínio e dos filtros", () => {
    expect(buildApolloCacheKey({ domain: "ACME.com", titles: ["CFO"] }))
      .toBe(buildApolloCacheKey({ domain: "acme.com", titles: ["cfo"] }));
  });

  it("remove duplicatas dos filtros", () => {
    expect(buildApolloCacheKey({ domain: "a.com", titles: ["CEO", "ceo", " CEO "] }))
      .toBe(buildApolloCacheKey({ domain: "a.com", titles: ["ceo"] }));
  });

  it("diferencia domínios, departamentos e tamanho", () => {
    const base = { domain: "a.com", departments: ["finance"], size: 10 };
    expect(buildApolloCacheKey(base)).not.toBe(buildApolloCacheKey({ ...base, domain: "b.com" }));
    expect(buildApolloCacheKey(base)).not.toBe(buildApolloCacheKey({ ...base, departments: ["sales"] }));
    expect(buildApolloCacheKey(base)).not.toBe(buildApolloCacheKey({ ...base, size: 25 }));
  });

  it("clampa o size dentro de 1..100", () => {
    expect(buildApolloCacheKey({ domain: "a.com", size: 0 }))
      .toBe(buildApolloCacheKey({ domain: "a.com", size: 1 }));
    expect(buildApolloCacheKey({ domain: "a.com", size: 5000 }))
      .toBe(buildApolloCacheKey({ domain: "a.com", size: 100 }));
  });
});

describe("ttlForResult", () => {
  it("resultado com contatos vive mais", () => {
    expect(ttlForResult(3)).toBe(APOLLO_CACHE_TTL_HIT_SECONDS);
  });
  it("resultado vazio expira mais rápido", () => {
    expect(ttlForResult(0)).toBe(APOLLO_CACHE_TTL_EMPTY_SECONDS);
    expect(APOLLO_CACHE_TTL_EMPTY_SECONDS).toBeLessThan(APOLLO_CACHE_TTL_HIT_SECONDS);
  });
});

describe("cooldownForStatus", () => {
  it("401/403 => cooldown longo", () => {
    expect(cooldownForStatus(401)).toBe(APOLLO_COOLDOWN_FORBIDDEN_SECONDS);
    expect(cooldownForStatus(403)).toBe(APOLLO_COOLDOWN_FORBIDDEN_SECONDS);
  });
  it("429 => cooldown curto", () => {
    expect(cooldownForStatus(429)).toBe(APOLLO_COOLDOWN_RATE_LIMIT_SECONDS);
  });
  it("erros transitórios comuns não aplicam cooldown", () => {
    expect(cooldownForStatus(500)).toBe(0);
    expect(cooldownForStatus(undefined)).toBe(0);
  });
});

describe("parseRateDecision", () => {
  it("permite quando a RPC devolve allowed", () => {
    const d = parseRateDecision({ allowed: true, reason: "ok", minute_remaining: 4, daily_remaining: 99 });
    expect(d).toMatchObject({ allowed: true, reason: "ok", minuteRemaining: 4, dailyRemaining: 99 });
  });

  it("bloqueia com motivo e retry", () => {
    const d = parseRateDecision({ allowed: false, reason: "cooldown", retry_after_seconds: 900 });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("cooldown");
    expect(d.retryAfterSeconds).toBe(900);
  });

  it("fail-open quando a resposta é inválida", () => {
    expect(parseRateDecision(null)).toEqual({ allowed: true, reason: "ok" });
    expect(parseRateDecision("boom")).toEqual({ allowed: true, reason: "ok" });
  });

  it("motivo desconhecido vira 'unavailable' sem liberar", () => {
    const d = parseRateDecision({ allowed: false, reason: "wat" });
    expect(d.reason).toBe("unavailable");
    expect(d.allowed).toBe(false);
  });
});
