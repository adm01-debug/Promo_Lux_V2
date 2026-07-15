// ============================================================================
// Departamentos PT → Lusha enum EN (single source of truth)
// ----------------------------------------------------------------------------
// Importável tanto por Edge Functions (Deno) quanto pelo front (Vite) via
// caminho relativo. NÃO adicionar deps externas aqui — deve permanecer puro.
// ============================================================================

export const DEPT_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Operations
  "compras": "Operations",
  "suprimentos": "Operations",
  "logistica": "Operations",
  "logística": "Operations",
  "operacoes": "Operations",
  "operações": "Operations",
  "supply chain": "Operations",
  "supply": "Operations",
  "procurement": "Operations",
  "estoque": "Operations",
  "almoxarifado": "Operations",
  "administrativo": "Operations",
  "administracao": "Operations",
  "administração": "Operations",
  "secretaria": "Operations",
  // Marketing
  "marketing": "Marketing",
  "comunicacao": "Marketing",
  "comunicação": "Marketing",
  "publicidade": "Marketing",
  "branding": "Marketing",
  "growth": "Marketing",
  "digital": "Marketing",
  // Human Resources
  "recursos humanos": "Human Resources",
  "rh": "Human Resources",
  "gente": "Human Resources",
  "pessoas": "Human Resources",
  "talentos": "Human Resources",
  "dp": "Human Resources",
  "departamento pessoal": "Human Resources",
  "cultura": "Human Resources",
  // Finance
  "financeiro": "Finance",
  "financeira": "Finance",
  "controladoria": "Finance",
  "contabilidade": "Finance",
  "contabil": "Finance",
  "contábil": "Finance",
  "tesouraria": "Finance",
  "fiscal": "Finance",
  "tributario": "Finance",
  "tributário": "Finance",
  "financas": "Finance",
  "finanças": "Finance",
  // IT
  "ti": "Information Technology",
  "tecnologia": "Information Technology",
  "sistemas": "Information Technology",
  "tic": "Information Technology",
  "infraestrutura": "Information Technology",
  "infra": "Information Technology",
  "desenvolvimento": "Information Technology",
  "dev": "Information Technology",
  "dados": "Information Technology",
  "data": "Information Technology",
  "segurança": "Information Technology",
  "seguranca": "Information Technology",
  "helpdesk": "Information Technology",
  // Business Development
  "vendas": "Business Development",
  "comercial": "Business Development",
  "negocios": "Business Development",
  "negócios": "Business Development",
  "desenvolvimento de negocios": "Business Development",
  "desenvolvimento de negócios": "Business Development",
  "bd": "Business Development",
  "account": "Business Development",
  "key account": "Business Development",
  // Customer Success
  "cs": "Customer Success",
  "customer success": "Customer Success",
  "sucesso do cliente": "Customer Success",
  // General Management
  "diretoria": "General Management",
  "presidencia": "General Management",
  "presidência": "General Management",
  "ceo": "General Management",
  "coo": "General Management",
  "cfo": "General Management",
  "cto": "General Management",
  "chro": "General Management",
  "diretores": "General Management",
  "gestao": "General Management",
  "gestão": "General Management",
  "gerencia": "General Management",
  "gerência": "General Management",
  "board": "General Management",
  // Engineering & Technical
  "engenharia": "Engineering & Technical",
  "p&d": "Engineering & Technical",
  "p e d": "Engineering & Technical",
  "pesquisa": "Engineering & Technical",
  "qualidade": "Engineering & Technical",
  "qa": "Engineering & Technical",
  "producao": "Engineering & Technical",
  "produção": "Engineering & Technical",
  "manutencao": "Engineering & Technical",
  "manutenção": "Engineering & Technical",
  "tecnico": "Engineering & Technical",
  "técnico": "Engineering & Technical",
  // Research & Analytics
  "bi": "Research & Analytics",
  "inteligencia": "Research & Analytics",
  "inteligência": "Research & Analytics",
  "analytics": "Research & Analytics",
  "pesquisa de mercado": "Research & Analytics",
  // Product
  "produto": "Product",
  "produtos": "Product",
  "product": "Product",
  "pm": "Product",
  // Design
  "ux": "Design",
  "design": "Design",
  // Legal
  "juridico": "Legal",
  "jurídico": "Legal",
  "legal": "Legal",
  "compliance": "Legal",
  // Health, Safety and Security
  "saude": "Health, Safety and Security",
  "saúde": "Health, Safety and Security",
  "ssma": "Health, Safety and Security",
  "seguranca do trabalho": "Health, Safety and Security",
  "medicina": "Health, Safety and Security",
});

/** Departamentos PT sugeridos na UI (chaves canônicas para exibição). */
export const SUGGESTED_DEPARTMENTS_PT: readonly string[] = Object.freeze([
  "Compras",
  "Marketing",
  "RH",
  "Financeiro",
  "TI",
  "Vendas",
  "Diretoria",
  "Engenharia",
  "Produto",
  "Jurídico",
  "Customer Success",
  "Operações",
]);

export interface DepartmentResolution {
  mapped: string[];      // enums Lusha (EN), únicos, ordem preservada
  notFound: string[];    // entradas do usuário não reconhecidas
}

/**
 * Normaliza entradas PT e mapeia para enums Lusha EN.
 * Idempotente, puro e case/acento-insensitive nas chaves conhecidas.
 */
export function resolveDepartments(input: readonly string[]): DepartmentResolution {
  const mapped: string[] = [];
  const notFound: string[] = [];
  for (const raw of input) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const en = DEPT_MAP[key];
    if (en) {
      if (!mapped.includes(en)) mapped.push(en);
    } else {
      notFound.push(raw);
    }
  }
  return { mapped, notFound };
}

/** Dado um enum EN e as entradas originais do usuário, encontra o rótulo PT. */
export function findPtLabelForEn(
  en: string,
  originalInputs: readonly string[],
): string {
  for (const raw of originalInputs) {
    if (DEPT_MAP[raw.trim().toLowerCase()] === en) return raw;
  }
  return en;
}
