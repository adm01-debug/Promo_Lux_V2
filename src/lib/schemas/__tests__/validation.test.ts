import { describe, it, expect } from "vitest";
import { validateScrapeJob } from "@/lib/schemas/scrapeJob";
import { validateCampaign } from "@/lib/schemas/campaign";
import { validateCompany } from "@/lib/schemas/company";

describe("validateScrapeJob", () => {
  const valid = { name: "Job1", keywords: "restaurantes", lang: "pt" as const, radius: 10000, depth: 1, email: true, fast_mode: false, auto_sync: false };

  it("accepts valid input", () => {
    expect(validateScrapeJob(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = validateScrapeJob({ ...valid, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.name).toBeDefined();
  });

  it("rejects empty keywords", () => {
    const r = validateScrapeJob({ ...valid, keywords: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.keywords).toBeDefined();
  });

  it("rejects invalid lang", () => {
    const r = validateScrapeJob({ ...valid, lang: "fr" as never });
    expect(r.success).toBe(false);
  });

  it("rejects radius out of range", () => {
    expect(validateScrapeJob({ ...valid, radius: 100 }).success).toBe(false);
    expect(validateScrapeJob({ ...valid, radius: 60000 }).success).toBe(false);
  });
});

describe("validateCampaign", () => {
  it("accepts valid input", () => {
    expect(validateCampaign({ name: "Campaign1", prospects: 50 }).success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = validateCampaign({ name: "", prospects: 50 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.name).toBeDefined();
  });

  it("rejects negative prospects", () => {
    const r = validateCampaign({ name: "X", prospects: -1 });
    expect(r.success).toBe(false);
  });
});

describe("validateCompany", () => {
  it("accepts valid input", () => {
    expect(validateCompany({ name: "Acme" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = validateCompany({ name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.name).toBeDefined();
  });

  it("rejects invalid email", () => {
    const r = validateCompany({ name: "X", email: "not-email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.email).toBeDefined();
  });

  it("rejects invalid website", () => {
    const r = validateCompany({ name: "X", website: "not-url" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.website).toBeDefined();
  });

  it("accepts empty optional fields", () => {
    expect(validateCompany({ name: "X", email: "", website: "", phone: "" }).success).toBe(true);
  });
});
