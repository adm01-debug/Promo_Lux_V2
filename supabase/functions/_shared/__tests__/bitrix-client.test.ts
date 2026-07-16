import { describe, it, expect } from "vitest";
import { resolveDeptEnum, BITRIX_STAGES, BITRIX_CATEGORY_ID, BITRIX_ENTITY_TYPE_ID } from "../bitrix-client";

describe("resolveDeptEnum", () => {
  it("resolve Compras", () => expect(resolveDeptEnum("Compras")).toBe(36182));
  it("resolve Marketing", () => expect(resolveDeptEnum("Marketing")).toBe(36184));
  it("resolve Recursos Humanos", () => expect(resolveDeptEnum("Recursos Humanos")).toBe(40144));
  it("é case-insensitive", () => expect(resolveDeptEnum("COMPRAS")).toBe(36182));
  it("ignora espaços nas bordas", () => expect(resolveDeptEnum("  Compras  ")).toBe(36182));
  it("é insensível a acento", () => expect(resolveDeptEnum("Comunicação")).toBe(36184));
  it("aceita apelido RH", () => expect(resolveDeptEnum("RH")).toBe(40144));
  it("aceita sinônimo Suprimentos", () => expect(resolveDeptEnum("Suprimentos")).toBe(36182));
  it("desconhecido vira vazio", () => expect(resolveDeptEnum("Jurídico")).toBe(""));
  it("null vira vazio", () => expect(resolveDeptEnum(null)).toBe(""));
  it("vazio vira vazio", () => expect(resolveDeptEnum("")).toBe(""));
});

describe("constantes do pipeline", () => {
  it("entityTypeId e categoryId batem com o n8n", () => {
    expect(BITRIX_ENTITY_TYPE_ID).toBe(1328);
    expect(BITRIX_CATEGORY_ID).toBe(284);
  });
  it("todos os stageIds pertencem ao funil DT1328_284", () => {
    for (const s of Object.values(BITRIX_STAGES)) {
      expect(s.startsWith("DT1328_284:")).toBe(true);
    }
  });
});

// ============================================================================
// createContact / createCard agora validam o id devolvido pelo Bitrix antes
// de retornar: se `id` não bater com /^\d+$/ (ex.: undefined, "", "undefined",
// objeto malformado), lançam BitrixError em vez de gravar "undefined" no banco
// e escapar da CHECK `lusha_contacts_bitrix_exige_id`. Não mockamos `fetch`
// aqui — a garantia é o teste de contrato que roda contra o webhook real
// no ambiente de staging.
// ============================================================================
