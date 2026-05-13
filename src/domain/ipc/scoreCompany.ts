/**
 * Lógica pura para cálculo de score IPC (Ideal Customer Profile).
 * 
 * Este módulo isola as regras de negócio de pontuação, permitindo
 * testes unitários exaustivos sem dependências de infraestrutura.
 */

export interface IPCConfig {
  sectors: string[];
  employees_min: number;
  employees_max: number;
  locations: string[];
  technologies: string[];
}

export interface CompanyStats {
  sector?: string;
  employees_count?: number;
  location?: string;
  tech_stack?: string[];
}

export interface ScoreResult {
  score: number; // 0 a 100
  matched_criteria: string[];
}

/**
 * Calcula a pontuação de uma empresa baseado na configuração de IPC.
 */
export function scoreCompany(company: CompanyStats, config: IPCConfig): ScoreResult {
  let points = 0;
  const matched_criteria: string[] = [];

  // 1. Setor (Peso 40)
  if (company.sector && config.sectors.some(s => s.toLowerCase() === company.sector?.toLowerCase())) {
    points += 40;
    matched_criteria.push("sector");
  }

  // 2. Tamanho (Funcionários) (Peso 30)
  if (company.employees_count !== undefined) {
    if (company.employees_count >= config.employees_min && company.employees_count <= config.employees_max) {
      points += 30;
      matched_criteria.push("employees_range");
    }
  }

  // 3. Localização (Peso 20)
  if (company.location && config.locations.some(l => l.toLowerCase() === company.location?.toLowerCase())) {
    points += 20;
    matched_criteria.push("location");
  }

  // 4. Tecnologias (Peso 10)
  if (company.tech_stack && company.tech_stack.length > 0) {
    const commonTechs = company.tech_stack.filter(t => 
      config.technologies.some(ct => ct.toLowerCase() === t.toLowerCase())
    );
    if (commonTechs.length > 0) {
      points += 10;
      matched_criteria.push("technologies");
    }
  }

  return {
    score: points,
    matched_criteria
  };
}
