import { describe, expect, it } from "vitest";
import {
  buildExistingKeyIndex,
  dedupeLeads,
  leadIdentity,
  normalizeJobTitle,
  normalizePersonName,
} from "../lead-identity.ts";

describe("normalizePersonName", () => {
  it("remove acento, caixa e espaço extra", () => {
    expect(normalizePersonName("  JOÃO   da Silva ")).toBe("joao da silva");
  });
  it("remove título de tratamento e sufixo geracional", () => {
    expect(normalizePersonName("Dr. João da Silva Jr.")).toBe("joao da silva");
    expect(normalizePersonName("Sra. Maria Souza Filho")).toBe("maria souza");
  });
  it("remove pronomes/siglas entre parênteses e e-mail colado", () => {
    expect(normalizePersonName("Ana Lima (ela/dela)")).toBe("ana lima");
    expect(normalizePersonName("Ana Lima ana@acme.com")).toBe("ana lima");
  });
  it("não zera nome que é só um sufixo", () => {
    expect(normalizePersonName("Junior")).toBe("junior");
  });
  it("devolve vazio para entrada inútil", () => {
    expect(normalizePersonName("")).toBe("");
    expect(normalizePersonName(null)).toBe("");
    expect(normalizePersonName("###")).toBe("");
  });
});

describe("normalizeJobTitle", () => {
  it("normaliza acento e pontuação preservando números", () => {
    expect(normalizeJobTitle("Diretor de T.I. — Nível 2")).toBe("diretor de t i nivel 2");
  });
});

describe("leadIdentity", () => {
  it("prioriza o public id do LinkedIn", () => {
    const id = leadIdentity({
      fullName: "João Silva",
      jobTitle: "CTO",
      linkedinUrl: "https://br.linkedin.com/in/joao-silva-123",
      companyDomain: "acme.com.br",
    });
    expect(id.keys[0]).toBe("pid:joao-silva-123");
    expect(id.keys).toContain("dn:acme.com.br|joao silva");
  });

  it("usa o domínio do e-mail além do domínio da empresa", () => {
    const id = leadIdentity({
      fullName: "Ana Lima",
      companyDomain: "https://www.acme.com/",
      email: "ana@acme.com",
    });
    expect(id.domains).toEqual(["acme.com"]);
  });

  it("sem nome não há identidade", () => {
    expect(leadIdentity({ fullName: "  ", jobTitle: "CEO" }).keys).toEqual([]);
  });

  it("nome sozinho vira chave quando não há domínio, cargo nem linkedin", () => {
    expect(leadIdentity({ fullName: "Ana Lima" }).keys).toEqual(["n:ana lima"]);
  });
});

const ident = (c: { fullName: string; jobTitle?: string; linkedinUrl?: string; domain?: string }) =>
  leadIdentity({
    fullName: c.fullName,
    jobTitle: c.jobTitle,
    linkedinUrl: c.linkedinUrl,
    companyDomain: c.domain ?? "acme.com",
  });

interface Lead {
  fullName: string;
  jobTitle?: string;
  linkedinUrl?: string;
  domain?: string;
  source: "lusha" | "apollo";
}

const dedupe = (items: Lead[]) =>
  dedupeLeads<Lead>(items, ident, {
    sourceOf: (i) => i.source,
    merge: (winner, loser) => ({
      ...winner,
      linkedinUrl: winner.linkedinUrl || loser.linkedinUrl,
      jobTitle: winner.jobTitle || loser.jobTitle,
    }),
  });

describe("dedupeLeads", () => {
  it("casa a mesma pessoa entre Lusha e Apollo apesar da grafia", () => {
    const r = dedupe([
      { fullName: "JOÃO DA SILVA", jobTitle: "Diretor", source: "apollo" },
      { fullName: "Dr. Joao da Silva Jr.", jobTitle: "Diretor", source: "lusha" },
    ]);
    expect(r.kept).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.kept[0].source).toBe("lusha"); // Lusha vence a Apollo
  });

  it("herda o LinkedIn da fonte perdedora", () => {
    const r = dedupe([
      { fullName: "João Silva", jobTitle: "CTO", source: "lusha" },
      { fullName: "Joao Silva", jobTitle: "CTO", linkedinUrl: "https://linkedin.com/in/joao-s", source: "apollo" },
    ]);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0].source).toBe("lusha");
    expect(r.kept[0].linkedinUrl).toBe("https://linkedin.com/in/joao-s");
  });

  it("casa por public id mesmo com subdomínio de país diferente", () => {
    const r = dedupe([
      { fullName: "Ana Lima", jobTitle: "CFO", linkedinUrl: "https://br.linkedin.com/in/ana-lima", source: "lusha" },
      { fullName: "A. Lima", jobTitle: "Finance", linkedinUrl: "https://www.linkedin.com/in/ana-lima/", source: "apollo" },
    ]);
    expect(r.kept).toHaveLength(1);
  });

  it("NÃO funde homônimos de empresas diferentes", () => {
    const r = dedupe([
      { fullName: "Ana Lima", jobTitle: "CFO", domain: "acme.com", source: "lusha" },
      { fullName: "Ana Lima", jobTitle: "CEO", domain: "outra.com", source: "apollo" },
    ]);
    expect(r.kept).toHaveLength(2);
    expect(r.duplicates).toBe(0);
  });

  it("mantém pessoas diferentes da mesma empresa", () => {
    const r = dedupe([
      { fullName: "Ana Lima", jobTitle: "CFO", source: "lusha" },
      { fullName: "Bruno Costa", jobTitle: "CFO", source: "lusha" },
    ]);
    expect(r.kept).toHaveLength(2);
  });

  it("descarta registros sem identidade utilizável", () => {
    const r = dedupe([{ fullName: "   ", jobTitle: "CEO", source: "apollo" }]);
    expect(r.kept).toHaveLength(0);
    expect(r.duplicates).toBe(0);
  });

  it("é transitivo: A casa com B por nome+cargo e C casa com B por linkedin", () => {
    const r = dedupe([
      { fullName: "Ana Lima", jobTitle: "CFO", source: "apollo" },
      { fullName: "Ana Lima", jobTitle: "CFO", linkedinUrl: "https://linkedin.com/in/ana-l", source: "lusha" },
      { fullName: "Ana P. Lima", jobTitle: "Diretora", linkedinUrl: "https://linkedin.com/in/ana-l", source: "apollo" },
    ]);
    expect(r.kept).toHaveLength(1);
    expect(r.duplicates).toBe(2);
  });
});

describe("buildExistingKeyIndex", () => {
  it("gera chaves que casam com um lead novo equivalente", () => {
    const keys = buildExistingKeyIndex(
      [{ full_name: "JOÃO DA SILVA", job_title: "Diretor", linkedin_url: null, linkedin_public_id: null }],
      "acme.com",
    );
    const novo = leadIdentity({ fullName: "Dr. Joao da Silva", jobTitle: "diretor", companyDomain: "acme.com" });
    expect(novo.keys.some((k) => keys.has(k))).toBe(true);
  });

  it("não casa pessoa diferente", () => {
    const keys = buildExistingKeyIndex(
      [{ full_name: "Ana Lima", job_title: "CFO", linkedin_url: null, linkedin_public_id: null }],
      "acme.com",
    );
    const novo = leadIdentity({ fullName: "Bruno Costa", jobTitle: "CFO", companyDomain: "acme.com" });
    expect(novo.keys.some((k) => keys.has(k))).toBe(false);
  });
});
