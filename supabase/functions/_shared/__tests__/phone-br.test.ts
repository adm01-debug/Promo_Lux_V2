import { describe, it, expect } from "vitest";
import { normalizePhoneBR, formatPhoneBitrix } from "../phone-br";

describe("normalizePhoneBR", () => {
  it("normaliza celular BR 11 dígitos", () => {
    const r = normalizePhoneBR("(11) 91234-5678");
    expect(r.e164).toBe("+5511912345678");
    expect(r.country).toBe("BR");
    expect(r.is_mobile).toBe(true);
    expect(r.ddd).toBe(11);
  });

  it("normaliza fixo BR 10 dígitos", () => {
    const r = normalizePhoneBR("21 3123-4567");
    expect(r.e164).toBe("+552131234567");
    expect(r.is_mobile).toBe(false);
  });

  it("aceita já com +55", () => {
    expect(normalizePhoneBR("+55 11 91234-5678").e164).toBe("+5511912345678");
  });

  it("aceita com 0055", () => {
    expect(normalizePhoneBR("0055 11 91234-5678").e164).toBe("+5511912345678");
  });

  it("passa internacional +49 sem alterar", () => {
    const r = normalizePhoneBR("+49 30 1234567");
    expect(r.country).toBe("INTL");
    expect(r.e164).toBe("+49301234567");
  });

  it("DDD inválido vira UNKNOWN", () => {
    const r = normalizePhoneBR("(00) 91234-5678");
    expect(r.e164).toBeNull();
    expect(r.country).toBe("UNKNOWN");
  });

  it("string vazia é UNKNOWN sem erro", () => {
    expect(normalizePhoneBR("").e164).toBeNull();
  });

  it("dígitos insuficientes é UNKNOWN", () => {
    expect(normalizePhoneBR("12345").e164).toBeNull();
  });

  // ── Regressão TD-6 ──
  it("preserva DDD 55 (RS) — o n8n destrói este caso", () => {
    const r = normalizePhoneBR("55980435545");
    expect(r.e164).toBe("+5555980435545");
    expect(r.ddd).toBe(55);
  });

  it("preserva DDD 55 com +55 na frente", () => {
    expect(normalizePhoneBR("+5555980435545").e164).toBe("+5555980435545");
  });

  it("aceita prefixo legado 0XX de operadora", () => {
    expect(normalizePhoneBR("011 91234-5678").e164).toBe("+5511912345678");
  });

  it("descarta ramal", () => {
    expect(normalizePhoneBR("11912345678 ramal 22").e164).toBe("+5511912345678");
  });

  it("descarta ext.", () => {
    expect(normalizePhoneBR("(11) 91234-5678 ext. 9").e164).toBe("+5511912345678");
  });

  it("lixo longo não vira número BR falso", () => {
    expect(normalizePhoneBR("1234567890123456").e164).toBeNull();
  });
});

describe("formatPhoneBitrix", () => {
  it("formata celular no padrão do CRM", () => {
    expect(formatPhoneBitrix(normalizePhoneBR("11912345678"))).toBe("+55 11 91234-5678");
  });

  it("injeta o 9 em número de 10 dígitos (paridade com n8n)", () => {
    expect(formatPhoneBitrix(normalizePhoneBR("1130001234"))).toBe("+55 11 93000-1234");
  });

  it("mantém internacional em E.164, sem converter para BR", () => {
    expect(formatPhoneBitrix(normalizePhoneBR("+1 415 555 2671"))).toBe("+14155552671");
  });

  it("retorna null para entrada inválida", () => {
    expect(formatPhoneBitrix(normalizePhoneBR("abc"))).toBeNull();
  });

  it("é idempotente (formatar o já formatado não muda)", () => {
    const uma = formatPhoneBitrix(normalizePhoneBR("11912345678"))!;
    expect(formatPhoneBitrix(normalizePhoneBR(uma))).toBe(uma);
  });
});
