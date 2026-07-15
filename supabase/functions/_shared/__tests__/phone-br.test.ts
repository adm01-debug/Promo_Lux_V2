import { describe, it, expect } from "vitest";
import { normalizePhoneBR } from "../phone-br";

// Nota: o helper vive em supabase/functions/_shared, importado só por edges.
// Este teste roda no ambiente Vitest via alias relativo para garantir a
// normalização BR (celular 11 dígitos, fixo 10, com/sem +55, DDD inválido).

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
    const r = normalizePhoneBR("+55 11 91234-5678");
    expect(r.e164).toBe("+5511912345678");
  });

  it("aceita com 0055", () => {
    const r = normalizePhoneBR("0055 11 91234-5678");
    expect(r.e164).toBe("+5511912345678");
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
    const r = normalizePhoneBR("");
    expect(r.e164).toBeNull();
  });

  it("dígitos insuficientes é UNKNOWN", () => {
    const r = normalizePhoneBR("12345");
    expect(r.e164).toBeNull();
  });
});
