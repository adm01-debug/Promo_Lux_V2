import { describe, it, expectTypeOf } from "vitest";
import type {
  DeptGroup,
  LushaContact,
  LushaSession,
  SearchResponse,
  DecisionMaker,
  DMCompanyResult,
  DMResponse,
  RevealedEntry,
} from "./types";

// Testes type-only (R34). Sem custo em runtime — apenas garantem que o shape
// dos contratos extraídos em R30/R31 não regride silenciosamente.

describe("types.ts (R34) — contratos", () => {
  it("DeptGroup: label + items", () => {
    expectTypeOf<DeptGroup>().toEqualTypeOf<{ label: string; items: string[] }>();
  });

  it("LushaContact aceita nullables e recusa campos ausentes", () => {
    const min: LushaContact = {
      id: "c1",
      full_name: "Ana",
      job_title: null,
      department_pt: null,
      linkedin_url: null,
      enrichment_status: null,
      created_at: "2026-07-22",
      session_id: null,
    };
    expectTypeOf(min).toMatchTypeOf<LushaContact>();
    expectTypeOf<LushaContact["job_title"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LushaContact["linkedin_url"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LushaContact["session_id"]>().toEqualTypeOf<string | null>();
  });

  it("LushaSession: arrays nullable e status nullable", () => {
    const full: LushaSession = {
      id: "s1",
      company_name: "ACME",
      departments_requested: ["Compras"],
      departments_mapped: ["Purchasing"],
      total_found: 12,
      status: "completed",
      error_message: null,
      created_at: "2026-07-22",
    };
    expectTypeOf(full).toMatchTypeOf<LushaSession>();
    expectTypeOf<LushaSession["departments_requested"]>().toEqualTypeOf<string[] | null>();
    expectTypeOf<LushaSession["total_found"]>().toEqualTypeOf<number | null>();
  });

  it("SearchResponse: todos os campos obrigatórios", () => {
    const r: SearchResponse = {
      session_id: "s1",
      company_resolved: "ACME",
      total_found: 0,
      departments_searched: [],
      departments_skipped: [],
      contacts: [],
    };
    expectTypeOf(r).toMatchTypeOf<SearchResponse>();
  });

  it("DecisionMaker: mínimo obrigatório + opcionais aceitos", () => {
    const min: DecisionMaker = {
      id: "d1",
      fullName: "João",
      jobTitle: "CPO",
      departments: ["Compras"],
      seniority: "C-Level",
      company: "ACME",
      location: "SP",
      linkedin: "https://linkedin.com/in/joao",
      hasEmail: true,
      hasPhone: false,
      emailCredits: 1,
      phoneCredits: 0,
    };
    expectTypeOf(min).toMatchTypeOf<DecisionMaker>();

    const max: DecisionMaker = {
      ...min,
      linkedinFollowersCount: 100,
      linkedinConnectionsCount: 500,
      linkedinSkills: ["negotiation"],
      linkedinCertifications: ["PMP"],
      linkedinCourses: ["Harvard"],
      linkedinAwards: ["Top Buyer"],
      xUrl: "https://x.com/joao",
    };
    expectTypeOf(max).toMatchTypeOf<DecisionMaker>();
    expectTypeOf<DecisionMaker["linkedinFollowersCount"]>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<DecisionMaker["xUrl"]>().toEqualTypeOf<string | null | undefined>();
  });

  it("DMCompanyResult: domain + decisionMakers obrigatórios, resto opcional", () => {
    const min: DMCompanyResult = { domain: "acme.com", decisionMakers: [] };
    expectTypeOf(min).toMatchTypeOf<DMCompanyResult>();
    const full: DMCompanyResult = {
      domain: "acme.com",
      companyId: "co-1",
      total: 3,
      error: "rate_limit",
      decisionMakers: [],
    };
    expectTypeOf(full).toMatchTypeOf<DMCompanyResult>();
  });

  it("DMResponse: contadores + results", () => {
    const r: DMResponse = {
      requestId: "req-1",
      creditsCharged: 5,
      totalDecisionMakers: 12,
      results: [],
    };
    expectTypeOf(r).toMatchTypeOf<DMResponse>();
  });

  it("RevealedEntry: emails/phones sempre arrays; error opcional", () => {
    const empty: RevealedEntry = { emails: [], phones: [] };
    expectTypeOf(empty).toMatchTypeOf<RevealedEntry>();
    const full: RevealedEntry = {
      emails: [{ email: "a@b.com", type: "work" }, { email: "c@d.com", type: null }],
      phones: [{ number: "+55...", type: null }],
      error: "forbidden",
    };
    expectTypeOf(full).toMatchTypeOf<RevealedEntry>();
  });
});
