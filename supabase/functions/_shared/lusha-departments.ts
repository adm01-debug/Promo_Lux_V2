// ============================================================================
// _shared/lusha-departments.ts
// Mapa PT-BR -> enum de departamento da Lusha (EN).
// PORTADO BYTE-A-BYTE do nó "Prepara payload" do n8n
// "Captação de lead - Linkedin" (workflow ZRnakqmCSpGub7Wu), extraído em
// 17/07/2026 da instância viva. Fonte da verdade = n8n, NÃO a documentação.
//
// Se mudar aqui, mude no n8n também enquanto os dois coexistirem.
// ============================================================================

export const DEPARTMENT_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Operations
  "compras": "Operations", "suprimentos": "Operations", "procurement": "Operations",
  "logistica": "Operations", "logística": "Operations", "supply chain": "Operations",
  "operacoes": "Operations", "operações": "Operations", "operations": "Operations",
  "producao": "Operations", "produção": "Operations", "manufacturing": "Operations",
  "qualidade": "Operations", "quality": "Operations", "facilities": "Operations",
  "manutencao": "Operations", "manutenção": "Operations", "almoxarifado": "Operations",
  // Marketing
  "marketing": "Marketing", "comunicacao": "Marketing", "comunicação": "Marketing",
  "publicidade": "Marketing", "branding": "Marketing", "digital": "Marketing",
  "conteudo": "Marketing", "conteúdo": "Marketing", "growth": "Marketing",
  "social media": "Marketing", "trade": "Marketing", "eventos": "Marketing",
  // Human Resources
  "recursos humanos": "Human Resources", "rh": "Human Resources", "hr": "Human Resources",
  "gente": "Human Resources", "pessoas": "Human Resources", "people": "Human Resources",
  "talent": "Human Resources", "talentos": "Human Resources", "dp": "Human Resources",
  "departamento pessoal": "Human Resources", "recrutamento": "Human Resources",
  "treinamento": "Human Resources", "beneficios": "Human Resources",
  // Finance
  "financeiro": "Finance", "financeira": "Finance", "finance": "Finance",
  "controladoria": "Finance", "contabilidade": "Finance", "fiscal": "Finance",
  "tesouraria": "Finance", "treasury": "Finance", "auditoria": "Finance",
  "contabil": "Finance", "contábil": "Finance", "custos": "Finance",
  "orcamento": "Finance", "orçamento": "Finance",
  // Information Technology
  "ti": "Information Technology", "it": "Information Technology",
  "tecnologia": "Information Technology", "technology": "Information Technology",
  "sistemas": "Information Technology", "informatica": "Information Technology",
  "infra": "Information Technology", "infraestrutura": "Information Technology",
  "dados": "Information Technology", "data": "Information Technology",
  "seguranca": "Information Technology", "segurança": "Information Technology",
  "cloud": "Information Technology", "devops": "Information Technology",
  // Business Development
  "vendas": "Business Development", "comercial": "Business Development",
  "negocios": "Business Development", "negócios": "Business Development",
  "sales": "Business Development", "business development": "Business Development",
  "expansao": "Business Development", "expansão": "Business Development",
  "parcerias": "Business Development", "partnerships": "Business Development",
  // General Management
  "diretoria": "General Management", "presidencia": "General Management",
  "presidência": "General Management", "ceo": "General Management",
  "board": "General Management", "conselho": "General Management",
  "gestao": "General Management", "gestão": "General Management",
  "administracao": "General Management", "administração": "General Management",
  "gerencia": "General Management", "gerência": "General Management",
  // Engineering & Technical
  "engenharia": "Engineering & Technical", "engineering": "Engineering & Technical",
  "p&d": "Engineering & Technical", "pesquisa": "Engineering & Technical",
  "desenvolvimento": "Engineering & Technical", "tecnico": "Engineering & Technical",
  "técnico": "Engineering & Technical", "projetos": "Engineering & Technical",
  "arquitetura": "Engineering & Technical",
  // Customer Success
  "atendimento": "Customer Success", "customer success": "Customer Success",
  "cs": "Customer Success", "suporte": "Customer Success", "support": "Customer Success",
  "sac": "Customer Success", "pos venda": "Customer Success", "pós venda": "Customer Success",
  // Research & Analytics
  "bi": "Research & Analytics", "inteligencia": "Research & Analytics",
  "inteligência": "Research & Analytics", "analytics": "Research & Analytics",
  "dados estrategicos": "Research & Analytics", "pesquisa de mercado": "Research & Analytics",
  // Legal
  "juridico": "Legal", "jurídico": "Legal", "legal": "Legal",
  "compliance": "Legal", "regulatorio": "Legal", "regulatório": "Legal",
  // Product
  "produto": "Product", "produtos": "Product", "product": "Product",
  "ux": "Product", "design": "Product",
  // Health & Safety
  "saude": "Health & Safety", "saúde": "Health & Safety", "health": "Health & Safety",
  "seguranca do trabalho": "Health & Safety", "ssma": "Health & Safety",
  "meio ambiente": "Health & Safety",
  // Design
  "arte": "Design", "criacao": "Design", "criação": "Design", "creative": "Design",
});

/**
 * Normaliza o texto do departamento igual ao n8n:
 *   trim -> lowercase -> troca [.-] por espaço -> colapsa espaços -> trim
 *
 * ATENÇÃO — divergência consciente com o n8n: lá o mapa tem as chaves
 * "pos-venda"/"pós-venda", mas a própria normalização troca "-" por " " antes
 * do lookup, então essas chaves eram INALCANÇÁVEIS (bug latente no n8n).
 * Aqui as chaves estão gravadas como "pos venda"/"pós venda" para funcionarem.
 */
export function normalizeDepartmentKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Traduz um departamento PT-BR para o enum da Lusha. `null` se não mapeado. */
export function mapDepartment(raw: string): string | null {
  const key = normalizeDepartmentKey(raw);
  if (!key) return null;
  return DEPARTMENT_MAP[key] ?? null;
}

/**
 * Traduz uma lista separada por vírgula ("COMPRAS, MARKETING, RH").
 * Retorna os mapeados e os rejeitados — o chamador decide o que fazer com
 * os rejeitados (o n8n só logava e descartava em silêncio).
 */
export function mapDepartmentList(csv: string): {
  mapped: Array<{ pt: string; en: string }>;
  unmapped: string[];
} {
  const mapped: Array<{ pt: string; en: string }> = [];
  const unmapped: string[] = [];
  for (const part of String(csv ?? "").split(",")) {
    const pt = normalizeDepartmentKey(part);
    if (!pt) continue;
    const en = DEPARTMENT_MAP[pt];
    if (en) mapped.push({ pt, en });
    else unmapped.push(pt);
  }
  return { mapped, unmapped };
}
