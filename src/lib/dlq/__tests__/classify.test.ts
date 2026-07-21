import { describe, it, expect } from "vitest";
import { classifyDlqReason, DLQ_CATEGORIES, dlqCategoryLabel } from "../classify";

describe("classifyDlqReason", () => {
  it("classifica rede", () => {
    expect(classifyDlqReason("fetch failed: ETIMEDOUT").category).toBe("network");
    expect(classifyDlqReason("ECONNRESET").category).toBe("network");
  });

  it("classifica rate limit", () => {
    expect(classifyDlqReason("HTTP 429 Too Many Requests").category).toBe("rate_limit");
    expect(classifyDlqReason("quota exceeded").category).toBe("rate_limit");
  });

  it("classifica auth", () => {
    expect(classifyDlqReason("HTTP 401 unauthorized").category).toBe("auth");
    expect(classifyDlqReason("invalid_token").category).toBe("auth");
  });

  it("classifica not_found", () => {
    expect(classifyDlqReason("HTTP 404 not found").category).toBe("not_found");
  });

  it("classifica servidor", () => {
    expect(classifyDlqReason("HTTP 502 bad gateway").category).toBe("server");
    expect(classifyDlqReason("service unavailable").category).toBe("server");
  });

  it("classifica validação", () => {
    expect(classifyDlqReason("HTTP 400 invalid_body").category).toBe("validation");
  });

  it("fallback unknown", () => {
    expect(classifyDlqReason("weird thing").category).toBe("unknown");
    expect(classifyDlqReason(null).category).toBe("unknown");
    expect(classifyDlqReason("").category).toBe("unknown");
  });

  it("expõe todas as categorias com label PT-BR", () => {
    for (const cat of DLQ_CATEGORIES) {
      expect(dlqCategoryLabel(cat)).toBeTruthy();
    }
  });
});
