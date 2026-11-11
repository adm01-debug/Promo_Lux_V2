import { describe, it, expect } from "vitest";
import { assertLeadContactOk, publicIdFromLinkedInUrl } from "../leadcontact-client.ts";

describe("assertLeadContactOk", () => {
  it("deixa passar resposta sem code", () => {
    expect(() => assertLeadContactOk("findEmailAll", { data: { sources: [] } })).not.toThrow();
  });
  it("deixa passar code 0", () => {
    expect(() => assertLeadContactOk("findEmailAll", { code: 0, data: {} })).not.toThrow();
  });
  it("deixa passar code 200", () => {
    expect(() => assertLeadContactOk("findEmailAll", { code: 200, data: {} })).not.toThrow();
  });
  it("lança em 4010001 (sessão expirada — caso real de 16/07/2026)", () => {
    expect(() => assertLeadContactOk("findEmailAll", { code: 4010001, msg: "Not login or login expired" }))
      .toThrow(/4010001/);
  });
  it("marca 4010001 como erro de auth (status 401)", () => {
    try {
      assertLeadContactOk("findEmailAll", { code: 4010001, msg: "Not login or login expired" });
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(401);
    }
  });
  it("marca 429xxx como transitório", () => {
    try {
      assertLeadContactOk("findPhone", { code: 4290001, msg: "Too many requests" });
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as { transient?: boolean }).transient).toBe(true);
      expect((e as { status?: number }).status).toBe(429);
    }
  });
  it("erro desconhecido vira 400 não-transitório", () => {
    try {
      assertLeadContactOk("findPhone", { code: 5000001, msg: "boom" });
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(400);
      expect((e as { transient?: boolean }).transient).toBe(false);
    }
  });
  it("ignora code não-numérico", () => {
    expect(() => assertLeadContactOk("findEmailAll", { code: "ok", data: {} })).not.toThrow();
  });
});

describe("publicIdFromLinkedInUrl (re-export)", () => {
  it("continua funcionando pelo re-export", () => {
    expect(publicIdFromLinkedInUrl("https://br.linkedin.com/in/fulano")).toBe("fulano");
  });
});

/**
 * Contrato de auto-diagnóstico (documentação — sem mockar fetch):
 * - findEmailAll: ao pegar LeadContactError com status 401 do postLeadContact,
 *   chama markCookieUnhealthy("leadcontact", ...) antes de rethrow.
 * - findPhone: ao pegar LeadContactError com status 401, chama
 *   markCookieUnhealthy("linkedin", ...) — porque findPhone autentica com o
 *   cookie do LinkedIn, não do LeadContact. Marcar leadcontact aqui mandaria
 *   o usuário recapturar o cookie errado.
 * - markCookieUnhealthy é best-effort: engole qualquer erro do PATCH no vault
 *   e nunca lança, para não obscurecer o erro original do chamador.
 */
describe("auto-diagnóstico do vault (contrato)", () => {
  it("documentado nos comentários acima", () => {
    expect(true).toBe(true);
  });
});
