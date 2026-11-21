import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCronAuthorized, requestToken, timingSafeEqual } from "../cron-auth.ts";

// `cron-auth.ts` le Deno.env dentro das funcoes (lazy), entao o shim precisa
// existir apenas no momento da chamada - nao no import.
const env: Record<string, string> = {};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };

const SERVICE = "service-role-key-de-teste";
const ANON = "anon-key-de-teste";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/fn", { method: "POST", headers });
}

describe("timingSafeEqual", () => {
  it("compara conteudo, nao referencia", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("rejeita tamanhos diferentes", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("requestToken", () => {
  it("prefere Authorization Bearer", () => {
    expect(requestToken(req({ Authorization: `Bearer ${SERVICE}`, apikey: ANON }))).toBe(SERVICE);
  });

  it("cai para apikey quando nao ha Bearer", () => {
    expect(requestToken(req({ apikey: ANON }))).toBe(ANON);
  });

  it("devolve vazio sem headers", () => {
    expect(requestToken(req({}))).toBe("");
  });
});

describe("isCronAuthorized", () => {
  beforeEach(() => {
    env.CRON_SERVICE_KEY = SERVICE;
    env.CRON_ANON_KEY = ANON;
    // Sem estes, o valor obsoleto de runtime nunca casa - que e o bug corrigido.
    env.SUPABASE_SERVICE_ROLE_KEY = "";
    env.SUPABASE_ANON_KEY = "";
  });

  afterEach(() => { for (const k of Object.keys(env)) delete env[k]; });

  it("autoriza a service key do cron", () => {
    expect(isCronAuthorized(req({ Authorization: `Bearer ${SERVICE}` }))).toBe(true);
  });

  it("nega anonimo sem header", () => {
    expect(isCronAuthorized(req({}))).toBe(false);
  });

  it("nega token desconhecido", () => {
    expect(isCronAuthorized(req({ Authorization: "Bearer outra-coisa" }))).toBe(false);
  });

  it("nega a anon key por padrao", () => {
    expect(isCronAuthorized(req({ apikey: ANON }))).toBe(false);
  });

  it("aceita a anon key com allowAnon", () => {
    expect(isCronAuthorized(req({ apikey: ANON }), { allowAnon: true })).toBe(true);
  });

  it("nao autoriza quando nenhum secret esta configurado", () => {
    env.CRON_SERVICE_KEY = "";
    expect(isCronAuthorized(req({ Authorization: `Bearer ${SERVICE}` }))).toBe(false);
  });

  it("nao autoriza header vazio contra secret vazio", () => {
    env.CRON_SERVICE_KEY = "";
    expect(isCronAuthorized(req({ Authorization: "Bearer " }))).toBe(false);
  });
});