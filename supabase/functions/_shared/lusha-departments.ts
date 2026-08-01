// ============================================================================
// _shared/lusha-departments.ts
// Mapa PT-BR -> enums de departamento da Lusha.
//
// ⚠️ OS 16 ENUMS ABAIXO SÃO OS ÚNICOS VÁLIDOS. Provado em 17/07/2026 por:
//   1. GET api.lusha.com/prospecting/filters/contacts/departments (grátis)
//   2. Chamada real ao dashboard: enum inválido devolve HTTP 201 com corpo
//      {"error":"SEARCH_ENGINE_ERROR","statusCode":422,
//       "additionalInfo":{"errorDetails":[{"category":"departments"}]}}
//
// Erros corrigidos (existiam no n8n E no departmentMap.ts):
//   • "Customer Success"            -> NÃO EXISTE. O certo é "Customer Service".
//   • "Design"                      -> NÃO EXISTE.
//   • "Health & Safety"             -> NÃO EXISTE (valor do n8n).
//   • "Health, Safety and Security" -> NÃO EXISTE (valor do departmentMap.ts).
//   • "Sales" existia e ninguém usava: o n8n jogava "vendas" em
//     "Business Development" (27 na Lactalis) e perdia "Sales" (1421).
//
// SSMA/segurança do trabalho -> Operations. Não é chute: a busca real por
// Operations na Ambev devolveu "Environment, Health and Safety Manager".
//
// mapDepartment devolve string[] porque contactDepartment é array com OR +
// dedup nativo. Provado: Sales(1421)+BusinessDevelopment(27) = 1444, não 1448.
// ============================================================================

/** Os 16 únicos valores aceitos. Qualquer outro -> 422 SEARCH_ENGINE_ERROR. */
export const LUSHA_DEPARTMENTS: readonly string[] = Object.freeze([
  "Business Development", "Consulting", "Customer Service", "Engineering & Technical",
  "Finance", "General Management", "Health Care & Medical", "Human Resources",
  "Information Technology", "Legal", "Marketing", "Operations", "Other", "Product",
  "Research & Analytics", "Sales",
]);

const OPS = ["Operations"];
const MKT = ["Marketing"];
const HR = ["Human Resources"];
const FIN = ["Finance"];
const IT = ["Information Technology"];
const BD = ["Business Development"];
const GM = ["General Management"];
const ENG = ["Engineering & Technical"];
const CS = ["Customer Service"];
const RA = ["Research & Analytics"];
const LEG = ["Legal"];
const PRD = ["Product"];
const MED = ["Health Care & Medical"];
const CON = ["Consulting"];
/** Decisão do Joaquim (17/07/2026): "vendas" busca os dois. */
const VENDAS = ["Sales", "Business Development"];
/** "desenvolvimento" é ambíguo em PT: software (IT) ou produto (Engenharia). */
const DEV = ["Information Technology", "Engineering & Technical"];

export const DEPARTMENT_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // ── Operations
  "compras": OPS, "suprimentos": OPS, "procurement": OPS, "logistica": OPS, "logística": OPS,
  "supply chain": OPS, "supply": OPS, "operacoes": OPS, "operações": OPS, "operations": OPS,
  "producao": OPS, "produção": OPS, "manufacturing": OPS, "qualidade": OPS, "quality": OPS,
  "qa": OPS, "facilities": OPS, "manutencao": OPS, "manutenção": OPS, "almoxarifado": OPS,
  "estoque": OPS, "pcp": OPS,
  "seguranca do trabalho": OPS, "segurança do trabalho": OPS, "ssma": OPS,
  "meio ambiente": OPS, "sesmt": OPS,
  // ── Marketing (inclui arte/criação: "Design" não existe na Lusha)
  "marketing": MKT, "comunicacao": MKT, "comunicação": MKT, "publicidade": MKT,
  "branding": MKT, "digital": MKT, "conteudo": MKT, "conteúdo": MKT, "growth": MKT,
  "social media": MKT, "trade": MKT, "trade marketing": MKT, "eventos": MKT,
  "arte": MKT, "criacao": MKT, "criação": MKT, "creative": MKT,
  // ── Human Resources
  "recursos humanos": HR, "rh": HR, "hr": HR, "gente": HR, "pessoas": HR, "people": HR,
  "gente e gestao": HR, "gente e gestão": HR, "talent": HR, "talentos": HR, "dp": HR,
  "departamento pessoal": HR, "recrutamento": HR, "treinamento": HR, "beneficios": HR,
  "benefícios": HR, "cultura": HR,
  // ── Finance
  "financeiro": FIN, "financeira": FIN, "finance": FIN, "financas": FIN, "finanças": FIN,
  "controladoria": FIN, "contabilidade": FIN, "contabil": FIN, "contábil": FIN,
  "fiscal": FIN, "tributario": FIN, "tributário": FIN, "tesouraria": FIN, "treasury": FIN,
  "auditoria": FIN, "custos": FIN, "orcamento": FIN, "orçamento": FIN, "faturamento": FIN,
  // ── Information Technology
  "ti": IT, "it": IT, "tic": IT, "tecnologia": IT, "technology": IT, "sistemas": IT,
  "informatica": IT, "informática": IT, "infra": IT, "infraestrutura": IT, "dados": IT,
  "data": IT, "seguranca": IT, "segurança": IT, "seguranca da informacao": IT,
  "segurança da informação": IT, "cloud": IT, "devops": IT, "helpdesk": IT, "suporte tecnico": IT,
  // ── Sales / Business Development
  "vendas": VENDAS, "comercial": VENDAS, "sales": VENDAS,
  "negocios": BD, "negócios": BD, "business development": BD, "bd": BD,
  "desenvolvimento de negocios": BD, "desenvolvimento de negócios": BD,
  "expansao": BD, "expansão": BD, "parcerias": BD, "partnerships": BD,
  "account": BD, "key account": BD,
  // ── General Management
  "diretoria": GM, "diretores": GM, "presidencia": GM, "presidência": GM, "ceo": GM,
  "coo": GM, "cfo": GM, "cto": GM, "chro": GM, "board": GM, "conselho": GM,
  "gestao": GM, "gestão": GM, "administracao": GM, "administração": GM,
  "administrativo": GM, "gerencia": GM, "gerência": GM, "socios": GM, "sócios": GM,
  // ── Engineering & Technical
  "engenharia": ENG, "engineering": ENG, "p&d": ENG, "p & d": ENG, "p e d": ENG,
  "pesquisa": ENG, "tecnico": ENG, "técnico": ENG, "projetos": ENG, "arquitetura": ENG,
  "desenvolvimento": DEV, "dev": DEV,
  // ── Customer Service ("Customer Success" NÃO existe -> era 422)
  "atendimento": CS, "customer success": CS, "customer service": CS, "cs": CS,
  "sucesso do cliente": CS, "suporte": CS, "support": CS, "sac": CS,
  "pos venda": CS, "pós venda": CS, "relacionamento": CS, "ouvidoria": CS,
  // ── Research & Analytics
  "bi": RA, "inteligencia": RA, "inteligência": RA, "analytics": RA,
  "inteligencia de mercado": RA, "inteligência de mercado": RA,
  "dados estrategicos": RA, "pesquisa de mercado": RA,
  // ── Legal
  "juridico": LEG, "jurídico": LEG, "legal": LEG, "compliance": LEG,
  "regulatorio": LEG, "regulatório": LEG, "contratos": LEG, "lgpd": LEG,
  // ── Product ("Design" NÃO existe -> ux/design caem aqui)
  "produto": PRD, "produtos": PRD, "product": PRD, "pm": PRD, "ux": PRD, "design": PRD,
  // ── Health Care & Medical (saúde de verdade; NÃO segurança do trabalho)
  "saude": MED, "saúde": MED, "health": MED, "medicina": MED,
  "medicina do trabalho": MED, "ambulatorio": MED, "ambulatório": MED,
  // ── Consulting
  "consultoria": CON, "consulting": CON,
});

/**
 * Normaliza igual ao n8n: trim -> lower -> [.-] vira espaço -> colapsa -> trim.
 * BUG DO n8n CORRIGIDO: lá as chaves eram "pos-venda"/"pós-venda", mas a
 * normalização troca "-" por " " ANTES do lookup — eram inalcançáveis.
 */
export function normalizeDepartmentKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * PT-BR -> enums da Lusha. Array porque o filtro é OR nativo:
 *   "compras" -> ["Operations"]
 *   "vendas"  -> ["Sales", "Business Development"]
 * `[]` se não mapeado (o chamador decide — não descarte em silêncio).
 */
export function mapDepartment(raw: string): string[] {
  const key = normalizeDepartmentKey(raw);
  if (!key) return [];
  const hit = DEPARTMENT_MAP[key];
  return hit ? [...hit] : [];
}

export interface DepartmentResolution {
  /** um item por departamento PEDIDO — o loop de busca itera aqui */
  mapped: Array<{ pt: string; en: string[] }>;
  /** entradas não reconhecidas — reporte, não engula */
  notFound: string[];
}

/** Resolve a lista escolhida pelo usuário, preservando ordem e sem duplicar. */
export function resolveDepartments(input: readonly string[]): DepartmentResolution {
  const mapped: Array<{ pt: string; en: string[] }> = [];
  const notFound: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const key = normalizeDepartmentKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const en = mapDepartment(key);
    if (en.length > 0) mapped.push({ pt: raw.trim(), en });
    else notFound.push(raw.trim());
  }
  return { mapped, notFound };
}

/** Aceita "COMPRAS, MARKETING, RH" (como o n8n recebia). */
export function resolveDepartmentsCsv(csv: string): DepartmentResolution {
  return resolveDepartments(String(csv ?? "").split(","));
}

/** Guarda de sanidade: nenhum enum inválido pode vazar para a Lusha. */
export function assertValidDepartments(en: readonly string[]): void {
  const bad = en.filter((d) => !LUSHA_DEPARTMENTS.includes(d));
  if (bad.length > 0) {
    throw new Error(
      `departamento inválido para a Lusha: ${bad.join(", ")}. ` +
        `Válidos: ${LUSHA_DEPARTMENTS.join(", ")}`,
    );
  }
}

/** Rótulos PT sugeridos na UI. */
export const SUGGESTED_DEPARTMENTS_PT: readonly string[] = Object.freeze([
  "Compras", "Marketing", "RH", "Financeiro", "TI", "Vendas",
  "Diretoria", "Engenharia", "Produto", "Jurídico", "Atendimento", "Operações",
]);
