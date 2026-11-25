import { describe, it, expect, beforeEach } from "vitest";
import { db, setActiveOrgId, getActiveOrgId, MissingOrgContextError } from "@/integrations/supabase/withOrg";

describe("Multi-Tenant Isolation (SafeOrg)", () => {
  beforeEach(() => {
    setActiveOrgId(null);
  });

  it("should automatically inject organization_id into SELECT queries", () => {
    const mockOrgId = "123e4567-e89b-12d3-a456-426614174000";
    setActiveOrgId(mockOrgId);

    expect(getActiveOrgId()).toBe(mockOrgId);

    // This should NOT throw
    const query = db.from("companies").select("*");
    expect(query).toBeDefined();
  });

  it("should fail closed on SELECT when no organization is active", () => {
    setActiveOrgId(null);

    // Etapa 010: sem organização ativa a leitura não sai — mesmo contrato das
    // escritas. Antes o wrapper apenas avisava e consultava sem escopo.
    expect(() => db.from("companies").select("*")).toThrowError(MissingOrgContextError);
  });

  it("should block cross-tenant injection attempts in values", () => {
    const mockOrgId = "org-a";
    setActiveOrgId(mockOrgId);

    const payload = { name: "Test", organization_id: "org-b" };
    
    expect(() => {
      db.from("companies").insert(payload);
    }).toThrow(/Cross-org insert bloqueado/);
  });
});
