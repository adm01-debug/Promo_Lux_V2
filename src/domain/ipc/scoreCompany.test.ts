import { describe, it, expect } from "vitest";
import { scoreCompany, type IPCConfig, type CompanyStats } from "./scoreCompany";

describe("scoreCompany", () => {
  const mockConfig: IPCConfig = {
    sectors: ["Tecnologia", "Saúde"],
    employees_min: 10,
    employees_max: 100,
    locations: ["São Paulo", "Rio de Janeiro"],
    technologies: ["React", "Node.js"]
  };

  it("deve dar score 100 para match perfeito", () => {
    const company: CompanyStats = {
      sector: "Tecnologia",
      employees_count: 50,
      location: "São Paulo",
      tech_stack: ["React", "TypeScript"]
    };
    const result = scoreCompany(company, mockConfig);
    expect(result.score).toBe(100);
    expect(result.matched_criteria).toContain("sector");
    expect(result.matched_criteria).toContain("employees_range");
    expect(result.matched_criteria).toContain("location");
    expect(result.matched_criteria).toContain("technologies");
  });

  it("deve dar score 0 para nenhum match", () => {
    const company: CompanyStats = {
      sector: "Varejo",
      employees_count: 5,
      location: "Curitiba",
      tech_stack: ["PHP"]
    };
    const result = scoreCompany(company, mockConfig);
    expect(result.score).toBe(0);
    expect(result.matched_criteria).toHaveLength(0);
  });

  it("deve pontuar corretamente matches parciais", () => {
    const company: CompanyStats = {
      sector: "Tecnologia", // 40
      employees_count: 50,    // 30
    };
    const result = scoreCompany(company, mockConfig);
    expect(result.score).toBe(70);
    expect(result.matched_criteria).toEqual(["sector", "employees_range"]);
  });

  it("deve ignorar case sensitive nos setores", () => {
    const company: CompanyStats = { sector: "tecnologia" };
    const result = scoreCompany(company, mockConfig);
    expect(result.score).toBe(40);
  });
});
