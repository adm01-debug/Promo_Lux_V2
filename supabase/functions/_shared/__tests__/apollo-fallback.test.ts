import { describe, expect, it } from "vitest";
import { normalizeDomain, resolveCompanyDomain } from "../company-domain.ts";
import {
  apolloFilterForLushaDepartments,
  lushaEnumsWithoutApolloMapping,
} from "../apollo-departments.ts";
import { normalizeApolloResponse, normalizeApolloPerson } from "../apollo-client.ts";
import { publicIdFromLinkedInUrl } from "../linkedin-url.ts";

describe("normalizeDomain", () => {
  it("normaliza URLs completas", () => {
    expect(normalizeDomain("https://WWW.Ambev.com.br/carreiras?x=1")).toBe("ambev.com.br");
    expect(normalizeDomain("http://ambev.com.br:8080/path")).toBe("ambev.com.br");
    expect(normalizeDomain("  ambev.com.br.  ")).toBe("ambev.com.br");
  });

  it("extrai domínio de e-mail corporativo", () => {
    expect(normalizeDomain("joao.silva@Ambev.com.BR")).toBe("ambev.com.br");
  });

  it("rejeita valores inválidos e provedores gratuitos", () => {
    for (const bad of [null, undefined, "", "   ", "localhost", "não é domínio", "joao@gmail.com", "://", "-.com"]) {
      expect(normalizeDomain(bad as string)).toBe("");
    }
  });
});

describe("resolveCompanyDomain", () => {
  it("prioriza companies.website", () => {
    expect(
      resolveCompanyDomain({
        companyWebsite: "https://www.acme.com.br",
        lushaEmailDomain: "outro.com",
        lushaCompanyDomain: "terceiro.com",
      }),
    ).toEqual({ domain: "acme.com.br", source: "company_website" });
  });

  it("cai para o domínio de e-mail da Lusha", () => {
    expect(
      resolveCompanyDomain({ companyWebsite: "gmail.com", lushaEmailDomain: "acme.com" }),
    ).toEqual({ domain: "acme.com", source: "lusha_email_domain" });
  });

  it("retorna none quando nada é confiável", () => {
    expect(resolveCompanyDomain({ companyWebsite: null })).toEqual({ domain: "", source: "none" });
  });
});

describe("apollo-departments", () => {
  it("cobre todos os enums da Lusha", () => {
    expect(lushaEnumsWithoutApolloMapping()).toEqual([]);
  });

  it("faz união sem repetir para departamentos multi-enum", () => {
    const f = apolloFilterForLushaDepartments(["Sales", "Business Development"])!;
    expect(f).not.toBeNull();
    expect(new Set(f.departments).size).toBe(f.departments.length);
    expect(f.departments).toContain("master_sales");
    expect(f.departments).toContain("business_development");
  });

  it("retorna null para enum desconhecido", () => {
    expect(apolloFilterForLushaDepartments(["Inexistente"])).toBeNull();
  });
});

describe("normalizeApolloResponse", () => {
  it("payload vazio não quebra", () => {
    expect(normalizeApolloResponse({})).toEqual({ contacts: [], total: 0 });
    expect(normalizeApolloResponse(null)).toEqual({ contacts: [], total: 0 });
    expect(normalizeApolloResponse({ people: [] }).contacts).toHaveLength(0);
  });

  it("normaliza pessoa completa", () => {
    const r = normalizeApolloResponse({
      people: [
        {
          first_name: "Ana",
          last_name: "Souza",
          title: "Diretora Comercial",
          seniority: "director",
          linkedin_url: "https://br.linkedin.com/in/ana-souza-123",
          departments: ["master_sales", "business_development"],
        },
      ],
      pagination: { total_entries: 42 },
    });
    expect(r.total).toBe(42);
    expect(r.contacts[0]).toMatchObject({
      fullName: "Ana Souza",
      jobTitle: "Diretora Comercial",
      department: "master_sales",
      hasRevealedEmail: false,
      hasPhone: false,
    });
  });

  it("LinkedIn com subdomínio de país deduplica igual ao da Lusha", () => {
    const apollo = normalizeApolloPerson({
      name: "Ana Souza",
      linkedin_url: "https://br.linkedin.com/in/ana-souza-123/",
    })!;
    expect(publicIdFromLinkedInUrl(apollo.linkedinUrl)).toBe(
      publicIdFromLinkedInUrl("https://www.linkedin.com/in/ana-souza-123?trk=x"),
    );
  });

  it("descarta itens sem nome e sem cargo", () => {
    expect(normalizeApolloPerson({ linkedin_url: "x" })).toBeNull();
    expect(normalizeApolloPerson(null)).toBeNull();
  });
});
