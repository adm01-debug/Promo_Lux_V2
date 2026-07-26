// ============================================================================
// _shared/apollo-departments.ts
// Ponte entre os 16 enums de departamento da Lusha e os filtros do Apollo.io.
//
// O Apollo aceita `person_departments[]` (taxonomia própria, snake_case) e
// `person_titles[]` (texto livre, casamento por substring). Usamos os dois:
// department restringe a taxonomia, titles aumenta o recall em PT-BR — muitos
// perfis brasileiros no Apollo têm o cargo escrito em português.
//
// Invariante testada: TODO enum de LUSHA_DEPARTMENTS tem entrada aqui.
// ============================================================================

import { LUSHA_DEPARTMENTS } from "./lusha-departments.ts";

export interface ApolloDepartmentFilter {
  /** valores de `person_departments` do Apollo */
  departments: string[];
  /** `person_titles` — PT + EN, casamento por substring no Apollo */
  titles: string[];
}

const MAP: Readonly<Record<string, ApolloDepartmentFilter>> = Object.freeze({
  "Sales": {
    departments: ["master_sales"],
    titles: ["vendas", "comercial", "sales", "head of sales", "diretor comercial", "gerente comercial"],
  },
  "Business Development": {
    departments: ["business_development"],
    titles: ["business development", "desenvolvimento de negócios", "novos negócios", "parcerias", "partnerships"],
  },
  "Marketing": {
    departments: ["master_marketing"],
    titles: ["marketing", "comunicação", "growth", "trade marketing", "branding"],
  },
  "Human Resources": {
    departments: ["master_human_resources"],
    titles: ["recursos humanos", "rh", "human resources", "gente e gestão", "people", "departamento pessoal"],
  },
  "Finance": {
    departments: ["master_finance"],
    titles: ["financeiro", "finance", "controladoria", "contabilidade", "cfo", "tesouraria"],
  },
  "Information Technology": {
    departments: ["master_information_technology"],
    titles: ["tecnologia da informação", "ti", "information technology", "infraestrutura", "cto", "sistemas"],
  },
  "Engineering & Technical": {
    departments: ["master_engineering_technical"],
    titles: ["engenharia", "engineering", "projetos", "manutenção", "técnico"],
  },
  "Operations": {
    departments: ["master_operations"],
    titles: ["operações", "operations", "compras", "suprimentos", "logística", "supply chain", "produção", "qualidade"],
  },
  "General Management": {
    departments: ["c_suite", "master_operations"],
    titles: ["diretor", "diretoria", "presidente", "ceo", "coo", "sócio", "general manager", "gerente geral"],
  },
  "Customer Service": {
    departments: ["master_support"],
    titles: ["atendimento", "customer service", "customer success", "suporte", "pós-venda", "sac"],
  },
  "Product": {
    departments: ["master_product"],
    titles: ["produto", "product manager", "ux", "design", "product owner"],
  },
  "Legal": {
    departments: ["master_legal"],
    titles: ["jurídico", "legal", "compliance", "contratos", "regulatório"],
  },
  "Research & Analytics": {
    departments: ["master_data_science", "master_marketing"],
    titles: ["business intelligence", "bi", "analytics", "inteligência de mercado", "dados", "pesquisa de mercado"],
  },
  "Consulting": {
    departments: ["master_consulting"],
    titles: ["consultoria", "consultant", "consultor"],
  },
  "Health Care & Medical": {
    departments: ["medical_health"],
    titles: ["saúde", "medicina do trabalho", "médico", "health", "enfermagem"],
  },
  "Other": {
    departments: [],
    titles: ["gerente", "coordenador", "diretor", "manager", "head"],
  },
});

/**
 * Converte a lista de enums Lusha de um departamento pedido no filtro do
 * Apollo (união dos departamentos e títulos, sem repetição).
 * Retorna `null` quando nenhum enum tem correspondência utilizável.
 */
export function apolloFilterForLushaDepartments(
  lushaEnums: readonly string[],
): ApolloDepartmentFilter | null {
  const departments = new Set<string>();
  const titles = new Set<string>();
  let hit = false;

  for (const en of lushaEnums) {
    const f = MAP[en];
    if (!f) continue;
    hit = true;
    f.departments.forEach((d) => departments.add(d));
    f.titles.forEach((t) => titles.add(t));
  }

  if (!hit) return null;
  return { departments: [...departments], titles: [...titles] };
}

/** Usada pelos testes: garante paridade com a taxonomia da Lusha. */
export function lushaEnumsWithoutApolloMapping(): string[] {
  return LUSHA_DEPARTMENTS.filter((en) => !MAP[en]);
}

export const APOLLO_DEPARTMENT_MAP = MAP;
