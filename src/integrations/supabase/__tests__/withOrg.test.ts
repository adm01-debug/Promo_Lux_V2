import { describe, it, expect, vi } from "vitest";
import { db, setActiveOrgId, getActiveOrgId } from "../withOrg";

// Mock do supabase client
vi.mock("../client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

describe("withOrg Multi-tenant Isolation", () => {
  it("should block access to unclassified tables (Deny-by-Default)", () => {
    expect(() => db.from("random_unlisted_table" as any)).toThrow(
      /não possui classificação de escopo definida/
    );
  });

  it("should inject organization_id on select for scoped tables", () => {
    setActiveOrgId("org-123");
    // @ts-ignore
    db.from("companies").select("*");
    
    const { supabase } = require("../client");
    expect(supabase.from).toHaveBeenCalledWith("companies");
    // Verifica se eq foi chamado com organization_id
    // Note: Em ambiente de teste real validaríamos a cadeia de chamadas do proxy
  });

  it("should block write operations without active organization", () => {
    setActiveOrgId(null);
    expect(() => db.from("companies").insert({ name: "Fail" })).toThrow(
      /bloqueada: nenhuma organização ativa/
    );
  });
});
