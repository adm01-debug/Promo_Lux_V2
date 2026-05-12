import type { DashboardStats, RecentCompany } from "@/hooks/useDashboardData";

/* ── Dashboard Stats ── */
export const DEMO_STATS: DashboardStats = {
  activeWorkflows: 7,
  runningWorkflows: 3,
  totalCompanies: 1284,
  enrichedCompanies: 847,
  qualifiedCompanies: 198,
  conversionRate: 15,
  totalCompaniesCount: 1284,
  avgIpcScore: 72,
  todayScrapeJobs: 12,
  totalScrapeJobs: 48,
  completedScrapeJobs: 41,
};

/* ── Weekly Performance Chart ── */
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getRecentDayLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(DAY_LABELS[d.getDay()]);
  }
  return labels;
}

export const DEMO_PERFORMANCE = (() => {
  const labels = getRecentDayLabels();
  const raspadas = [42, 58, 35, 71, 93, 64, 87];
  const qualificadas = [18, 26, 14, 38, 52, 31, 49];
  return labels.map((day, i) => ({
    day,
    raspadas: raspadas[i],
    qualificadas: qualificadas[i],
  }));
})();

/* ── Recent Companies ── */
export const DEMO_COMPANIES: RecentCompany[] = [
  { id: "d1", name: "TechNova Solutions", sector: "Tecnologia", location: "São Paulo, SP", ipc_score: 92, source: "gmaps", website: "https://technova.com.br", enriched: true },
  { id: "d2", name: "Construtora Horizonte", sector: "Construção", location: "Curitiba, PR", ipc_score: 85, source: "gmaps", website: "https://horizonte.eng.br", enriched: true },
  { id: "d3", name: "Grupo Saúde Mais", sector: "Saúde", location: "Rio de Janeiro, RJ", ipc_score: 78, source: "linkedin", website: null, enriched: true },
  { id: "d4", name: "AgroTech Brasil", sector: "Agronegócio", location: "Ribeirão Preto, SP", ipc_score: 71, source: "gmaps", website: "https://agrotech.agr.br", enriched: false },
  { id: "d5", name: "Fintech Capital", sector: "Financeiro", location: "Belo Horizonte, MG", ipc_score: 88, source: "manual", website: "https://fintechcapital.com.br", enriched: true },
  { id: "d6", name: "EduStart Learning", sector: "Educação", location: "Florianópolis, SC", ipc_score: 65, source: "gmaps", website: null, enriched: false },
];

/* ── Activity Feed (notifications) ── */
function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

export const DEMO_ACTIVITY = [
  { id: "n1", type: "success", title: "Lead quente detectado", message: 'TechNova Solutions atingiu score IPC 92 — pronta para abordagem.', created_at: minutesAgo(3), read: false, metadata: {} },
  { id: "n2", type: "enrichment", title: "Empresa enriquecida", message: 'Construtora Horizonte foi enriquecida com dados de 12 fontes.', created_at: minutesAgo(12), read: false, metadata: {} },
  { id: "n3", type: "system", title: "Workflow concluído", message: 'O workflow "Prospecção SP Capital" processou 87 empresas com sucesso.', created_at: minutesAgo(28), read: false, metadata: {} },
  { id: "n4", type: "success", title: "Score IPC atualizado", message: 'Fintech Capital subiu de 74 para 88 após enriquecimento de dados.', created_at: minutesAgo(45), read: true, metadata: {} },
  { id: "n5", type: "enrichment", title: "Lote enriquecido", message: '34 empresas do lote "Saúde RJ" foram enriquecidas automaticamente.', created_at: minutesAgo(90), read: true, metadata: {} },
  { id: "n6", type: "error", title: "Raspagem falhou", message: 'A raspagem "Restaurantes Zona Sul" falhou por timeout. Tente novamente.', created_at: minutesAgo(120), read: true, metadata: {} },
  { id: "n7", type: "signal", title: "Novo sinal de intenção", message: 'Grupo Saúde Mais visitou a página de preços 3x nas últimas 24h.', created_at: minutesAgo(180), read: true, metadata: {} },
  { id: "n8", type: "success", title: "Campanha enviada", message: 'Campanha "Outbound Tech Q1" enviou 156 e-mails com taxa de abertura de 34%.', created_at: minutesAgo(240), read: true, metadata: {} },
];

/* ── Workflows ── */
export const DEMO_WORKFLOWS = [
  { id: "w1", name: "Prospecção SP Capital", status: "running", success_rate: 78, last_run_at: minutesAgo(5), leads_processed: 342, leads_qualified: 89, description: "Pipeline automático São Paulo", config: {}, steps: [{ id: "s1", type: "source", label: "Google Maps Scraper", provider: "gmaps.atomicabr" }, { id: "s2", type: "enrich", label: "Importar & Enriquecer", provider: "Waterfall" }, { id: "s3", type: "filter", label: "Scoring IPC", provider: "LUX IA" }, { id: "s4", type: "action", label: "Salvar no Banco", provider: "Lovable Cloud" }], created_at: minutesAgo(10000), updated_at: minutesAgo(5), user_id: "demo" },
  { id: "w2", name: "Enriquecimento Saúde", status: "active", success_rate: 92, last_run_at: minutesAgo(28), leads_processed: 156, leads_qualified: 67, description: "Enriquecer leads do setor saúde", config: {}, steps: [{ id: "s1", type: "source", label: "LinkedIn Scraper", provider: "linkedin" }, { id: "s2", type: "enrich", label: "Enriquecer", provider: "Waterfall" }, { id: "s3", type: "filter", label: "Scoring IPC", provider: "LUX IA" }], created_at: minutesAgo(20000), updated_at: minutesAgo(28), user_id: "demo" },
  { id: "w3", name: "Scraping Curitiba", status: "completed", success_rate: 65, last_run_at: minutesAgo(120), leads_processed: 89, leads_qualified: 23, description: "Raspagem região Curitiba", config: {}, steps: [{ id: "s1", type: "source", label: "Google Maps Scraper", provider: "gmaps" }, { id: "s2", type: "enrich", label: "Enriquecer", provider: "Waterfall" }], created_at: minutesAgo(30000), updated_at: minutesAgo(120), user_id: "demo" },
  { id: "w4", name: "Qualificação IPC Alto", status: "paused", success_rate: 45, last_run_at: minutesAgo(360), leads_processed: 210, leads_qualified: 54, description: "Filtrar IPC acima de 75", config: {}, steps: [{ id: "s1", type: "filter", label: "Scoring IPC", provider: "LUX IA" }, { id: "s2", type: "action", label: "Export CRM", provider: "Lovable Cloud" }], created_at: minutesAgo(40000), updated_at: minutesAgo(360), user_id: "demo" },
  { id: "w5", name: "Outbound Fintech", status: "draft", success_rate: 0, last_run_at: null, leads_processed: 0, leads_qualified: 0, description: "Campanha fintechs BH", config: {}, steps: [], created_at: minutesAgo(50000), updated_at: minutesAgo(1000), user_id: "demo" },
  { id: "w6", name: "SaaS B2B Nacional", status: "active", success_rate: 68, last_run_at: minutesAgo(30), leads_processed: 437, leads_qualified: 298, description: "Mapeamento completo de SaaS B2B", config: {}, steps: [{ id: "s1", type: "source", label: "Google Maps Scraper", provider: "gmaps" }, { id: "s2", type: "enrich", label: "Enriquecer", provider: "Waterfall" }, { id: "s3", type: "filter", label: "Scoring IPC", provider: "LUX IA" }, { id: "s4", type: "action", label: "Campanhas", provider: "Outreach" }], created_at: minutesAgo(60000), updated_at: minutesAgo(30), user_id: "demo" },
  { id: "w7", name: "E-commerce Premium", status: "completed", success_rate: 73, last_run_at: minutesAgo(720), leads_processed: 215, leads_qualified: 156, description: "E-commerces com faturamento >R$10M", config: {}, steps: [{ id: "s1", type: "source", label: "Google Maps Scraper", provider: "gmaps" }, { id: "s2", type: "enrich", label: "Enriquecer", provider: "Waterfall" }, { id: "s3", type: "filter", label: "Scoring IPC", provider: "LUX IA" }], created_at: minutesAgo(70000), updated_at: minutesAgo(720), user_id: "demo" },
];

/* ── Enrichment Funnel ── */
export const DEMO_FUNNEL = {
  total: 1284,
  enriched: 847,
  highScore: 412,
  qualified: 198,
};

/* ── Full Companies List ── */
export const DEMO_COMPANIES_FULL = [
  { id: "c01", name: "TechNova Solutions", sector: "Tecnologia", location: "São Paulo, SP", ipcScore: 92, source: "gmaps", website: "https://technova.com.br", employees: "50-200", revenue: "R$ 5M-10M", email: "contato@technova.com.br", phone: "(11) 3456-7890", enriched: true, starred: true },
  { id: "c02", name: "DataPulse Analytics", sector: "Dados & BI", location: "Campinas, SP", ipcScore: 87, source: "gmaps", website: "https://datapulse.io", employees: "10-50", revenue: "R$ 1M-5M", email: "hello@datapulse.io", phone: "(19) 3321-4455", enriched: true, starred: true },
  { id: "c03", name: "CloudBridge Infra", sector: "Cloud & DevOps", location: "Curitiba, PR", ipcScore: 95, source: "linkedin", website: "https://cloudbridge.com.br", employees: "200-500", revenue: "R$ 10M-50M", email: "sales@cloudbridge.com.br", phone: "(41) 3222-8899", enriched: true, starred: true },
  { id: "c04", name: "Agro Digital Plus", sector: "AgTech", location: "Ribeirão Preto, SP", ipcScore: 78, source: "gmaps", website: "https://agrodigital.com.br", employees: "50-200", revenue: "R$ 5M-10M", email: "info@agrodigital.com.br", phone: "(16) 3610-2233", enriched: true, starred: false },
  { id: "c05", name: "FinEdge Pagamentos", sector: "Fintech", location: "Belo Horizonte, MG", ipcScore: 98, source: "manual", website: "https://finedge.com.br", employees: "200-500", revenue: "R$ 50M+", email: "contato@finedge.com.br", phone: "(31) 3555-1122", enriched: true, starred: true },
  { id: "c06", name: "EduSpark Plataforma", sector: "EdTech", location: "Florianópolis, SC", ipcScore: 72, source: "gmaps", website: "https://eduspark.com.br", employees: "10-50", revenue: "R$ 1M-5M", email: "team@eduspark.com.br", phone: "(48) 3333-4455", enriched: false, starred: false },
  { id: "c07", name: "LogiTrack Frotas", sector: "Logística", location: "Goiânia, GO", ipcScore: 81, source: "gmaps", website: "https://logitrack.com.br", employees: "50-200", revenue: "R$ 5M-10M", email: "comercial@logitrack.com.br", phone: "(62) 3211-9900", enriched: true, starred: false },
  { id: "c08", name: "SaúdeTech Pro", sector: "HealthTech", location: "Porto Alegre, RS", ipcScore: 68, source: "linkedin", website: "https://saudetech.pro", employees: "10-50", revenue: "R$ 1M-5M", email: "contato@saudetech.pro", phone: "(51) 3044-7788", enriched: false, starred: false },
  { id: "c09", name: "RetailMax Commerce", sector: "E-commerce", location: "Rio de Janeiro, RJ", ipcScore: 90, source: "manual", website: "https://retailmax.com.br", employees: "500+", revenue: "R$ 50M+", email: "vendas@retailmax.com.br", phone: "(21) 3877-6655", enriched: true, starred: true },
  { id: "c10", name: "GreenEnergy Solar", sector: "Energia", location: "Salvador, BA", ipcScore: 85, source: "gmaps", website: "https://greenenergy.com.br", employees: "50-200", revenue: "R$ 10M-50M", email: "solar@greenenergy.com.br", phone: "(71) 3456-0011", enriched: true, starred: false },
  { id: "c11", name: "CyberShield Segurança", sector: "Cybersecurity", location: "Brasília, DF", ipcScore: 88, source: "linkedin", website: "https://cybershield.com.br", employees: "50-200", revenue: "R$ 5M-10M", email: "info@cybershield.com.br", phone: "(61) 3322-5544", enriched: true, starred: true },
  { id: "c12", name: "PixelForge Design", sector: "Design & UX", location: "Recife, PE", ipcScore: 55, source: "gmaps", website: "https://pixelforge.design", employees: "10-50", revenue: "R$ 500K-1M", email: "hello@pixelforge.design", phone: "(81) 3111-2233", enriched: false, starred: false },
  { id: "c13", name: "Constru+ Engenharia", sector: "Construção", location: "Manaus, AM", ipcScore: 62, source: "gmaps", website: "https://construplus.eng.br", employees: "200-500", revenue: "R$ 10M-50M", email: "projetos@construplus.eng.br", phone: "(92) 3234-5566", enriched: false, starred: false },
  { id: "c14", name: "FoodTech Delivery", sector: "FoodTech", location: "Fortaleza, CE", ipcScore: 76, source: "gmaps", website: "https://foodtech.delivery", employees: "50-200", revenue: "R$ 5M-10M", email: "contato@foodtech.delivery", phone: "(85) 3456-7788", enriched: true, starred: false },
  { id: "c15", name: "SmartFarm IoT", sector: "IoT / AgTech", location: "Uberlândia, MG", ipcScore: 71, source: "manual", website: "https://smartfarm.agr.br", employees: "10-50", revenue: "R$ 1M-5M", email: "iot@smartfarm.agr.br", phone: "(34) 3233-1100", enriched: false, starred: false },
  { id: "c16", name: "PayFlow Digital", sector: "Fintech", location: "São Paulo, SP", ipcScore: 94, source: "linkedin", website: "https://payflow.digital", employees: "200-500", revenue: "R$ 50M+", email: "biz@payflow.digital", phone: "(11) 3200-8800", enriched: true, starred: true },
  { id: "c17", name: "VidaPlena Wellness", sector: "HealthTech", location: "Curitiba, PR", ipcScore: 66, source: "gmaps", website: "https://vidaplena.com.br", employees: "10-50", revenue: "R$ 500K-1M", email: "contato@vidaplena.com.br", phone: "(41) 3100-2200", enriched: false, starred: false },
  { id: "c18", name: "DroneMap Agro", sector: "AgTech", location: "Piracicaba, SP", ipcScore: 83, source: "gmaps", website: "https://dronemap.agro", employees: "50-200", revenue: "R$ 5M-10M", email: "info@dronemap.agro", phone: "(19) 3400-5500", enriched: true, starred: false },
  { id: "c19", name: "NeoBank Brasil", sector: "Fintech", location: "São Paulo, SP", ipcScore: 91, source: "manual", website: "https://neobank.com.br", employees: "500+", revenue: "R$ 50M+", email: "parcerias@neobank.com.br", phone: "(11) 3600-7700", enriched: true, starred: true },
  { id: "c20", name: "StackLabs DevTools", sector: "Tecnologia", location: "Florianópolis, SC", ipcScore: 79, source: "linkedin", website: "https://stacklabs.dev", employees: "10-50", revenue: "R$ 1M-5M", email: "hi@stacklabs.dev", phone: "(48) 3500-6600", enriched: true, starred: false },
];

/* ── Campaigns ── */
export const DEMO_CAMPAIGNS = [
  { id: "camp1", name: "Outreach Fintechs Q1", status: "active", prospects: 156, sent: 142, opened: 89, replied: 34, meetings: 12, start_date: minutesAgo(20160), created_at: minutesAgo(20160), updated_at: minutesAgo(60), user_id: "demo", sequence: [{ step: "email_intro", delay: 0 }, { step: "follow_up_1", delay: 3 }, { step: "linkedin_connect", delay: 5 }, { step: "follow_up_2", delay: 7 }] },
  { id: "camp2", name: "Tech Leaders SP", status: "active", prospects: 89, sent: 89, opened: 52, replied: 18, meetings: 7, start_date: minutesAgo(10080), created_at: minutesAgo(10080), updated_at: minutesAgo(120), user_id: "demo", sequence: [{ step: "email_intro", delay: 0 }, { step: "follow_up_1", delay: 2 }, { step: "call", delay: 5 }] },
  { id: "camp3", name: "AgTech Decision Makers", status: "draft", prospects: 45, sent: 0, opened: 0, replied: 0, meetings: 0, start_date: null, created_at: minutesAgo(4320), updated_at: minutesAgo(4320), user_id: "demo", sequence: [{ step: "email_intro", delay: 0 }, { step: "follow_up_1", delay: 3 }] },
  { id: "camp4", name: "E-commerce Enterprise", status: "completed", prospects: 210, sent: 210, opened: 134, replied: 52, meetings: 21, start_date: minutesAgo(43200), created_at: minutesAgo(43200), updated_at: minutesAgo(1440), user_id: "demo", sequence: [{ step: "email_intro", delay: 0 }, { step: "follow_up_1", delay: 2 }, { step: "linkedin_connect", delay: 4 }, { step: "follow_up_2", delay: 7 }, { step: "call", delay: 10 }] },
  { id: "camp5", name: "Reativação Base Fria", status: "paused", prospects: 320, sent: 180, opened: 45, replied: 8, meetings: 2, start_date: minutesAgo(30240), created_at: minutesAgo(30240), updated_at: minutesAgo(2880), user_id: "demo", sequence: [{ step: "email_reengagement", delay: 0 }, { step: "follow_up", delay: 5 }] },
];

/* ── Intent Signals ── */
export const DEMO_INTENT_SIGNALS = [
  { id: "sig1", company_name: "CloudBridge Infra", type: "website_visit", signal: "Visitou página de preços 3x", strength: "high", details: "Múltiplas visitas à página de pricing em 24h", created_at: minutesAgo(15), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig2", company_name: "TechNova Solutions", type: "content_download", signal: "Baixou whitepaper sobre automação", strength: "high", details: "Download do ebook 'Automação de Prospecção 2026'", created_at: minutesAgo(45), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig3", company_name: "FinEdge Pagamentos", type: "job_posting", signal: "Vaga para Head de Vendas", strength: "medium", details: "Publicou vaga no LinkedIn para Head de Revenue", created_at: minutesAgo(120), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig4", company_name: "RetailMax Commerce", type: "funding", signal: "Rodada Série B de R$50M", strength: "high", details: "Captou R$50M em rodada liderada por Softbank", created_at: minutesAgo(240), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig5", company_name: "DataPulse Analytics", type: "technology_change", signal: "Migração para nova stack", strength: "medium", details: "Detectada migração de infraestrutura para AWS", created_at: minutesAgo(360), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig6", company_name: "GreenEnergy Solar", type: "website_visit", signal: "Visitou página de cases", strength: "low", details: "Visita única à página de cases de sucesso", created_at: minutesAgo(480), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig7", company_name: "Agro Digital Plus", type: "social_engagement", signal: "Engajou com post no LinkedIn", strength: "medium", details: "CEO curtiu e comentou post sobre IoT agrícola", created_at: minutesAgo(600), user_id: "demo", company_id: null, metadata: {} },
  { id: "sig8", company_name: "CyberShield Segurança", type: "job_posting", signal: "Contratando SDRs", strength: "high", details: "Abriu 3 vagas de SDR — sinal de expansão comercial", created_at: minutesAgo(720), user_id: "demo", company_id: null, metadata: {} },
];

/* ── Stakeholders ── */
export const DEMO_STAKEHOLDERS = [
  { id: "stk1", full_name: "Carlos Mendes", role: "CTO", department: "Tecnologia", seniority: "c-level", email: "carlos.mendes@technova.com.br", phone: null, linkedin_url: "https://linkedin.com/in/carlosmendes", confidence_score: 92, source: "linkedin", tags: ["decisor", "tech", "prioridade"], notes: null, last_contacted_at: null, created_at: minutesAgo(5000) },
  { id: "stk2", full_name: "Ana Rodrigues", role: "VP de Vendas", department: "Comercial", seniority: "vp", email: "ana.rodrigues@finedge.com.br", phone: "(31) 9 8888-1234", linkedin_url: "https://linkedin.com/in/anarodrigues", confidence_score: 88, source: "linkedin", tags: ["decisor", "vendas"], notes: null, last_contacted_at: minutesAgo(2000), created_at: minutesAgo(8000) },
  { id: "stk3", full_name: "Pedro Nakamura", role: "Head de Growth", department: "Marketing", seniority: "director", email: "pedro@datapulse.io", phone: null, linkedin_url: "https://linkedin.com/in/pedronakamura", confidence_score: 75, source: "linkedin", tags: ["influenciador", "growth"], notes: "Interessado em automação de marketing", last_contacted_at: null, created_at: minutesAgo(12000) },
  { id: "stk4", full_name: "Mariana Silva", role: "CEO", department: "Diretoria", seniority: "c-level", email: "mariana@cloudbridge.com.br", phone: "(41) 9 7777-5678", linkedin_url: "https://linkedin.com/in/marianasilva", confidence_score: 95, source: "manual", tags: ["decisor", "c-level", "prioridade"], notes: "Decisora final para compras acima de R$50K", last_contacted_at: minutesAgo(500), created_at: minutesAgo(15000) },
  { id: "stk5", full_name: "Lucas Ferreira", role: "Gerente de Compras", department: "Procurement", seniority: "manager", email: "lucas.ferreira@retailmax.com.br", phone: "(21) 9 6666-9012", linkedin_url: "https://linkedin.com/in/lucasferreira", confidence_score: 70, source: "linkedin", tags: ["comprador", "enterprise"], notes: null, last_contacted_at: null, created_at: minutesAgo(18000) },
  { id: "stk6", full_name: "Juliana Costa", role: "Diretora de Inovação", department: "Inovação", seniority: "director", email: "juliana@agrodigital.com.br", phone: null, linkedin_url: "https://linkedin.com/in/julianacosta", confidence_score: 82, source: "linkedin", tags: ["decisor", "inovação", "agtech"], notes: "Busca soluções de automação para agro", last_contacted_at: minutesAgo(3000), created_at: minutesAgo(20000) },
  { id: "stk7", full_name: "Roberto Almeida", role: "CFO", department: "Financeiro", seniority: "c-level", email: "roberto@payflow.digital", phone: "(11) 9 5555-3456", linkedin_url: "https://linkedin.com/in/robertoalmeida", confidence_score: 90, source: "linkedin", tags: ["decisor", "c-level", "fintech"], notes: null, last_contacted_at: null, created_at: minutesAgo(22000) },
  { id: "stk8", full_name: "Fernanda Oliveira", role: "Head de Produto", department: "Produto", seniority: "director", email: "fernanda@neobank.com.br", phone: null, linkedin_url: "https://linkedin.com/in/fernandaoliveira", confidence_score: 78, source: "linkedin", tags: ["influenciador", "produto"], notes: "Avaliando soluções de BI para o time de produto", last_contacted_at: minutesAgo(1500), created_at: minutesAgo(25000) },
];

/* ── Notifications ── */
export const DEMO_NOTIFICATIONS = [
  { id: "notif1", type: "enrichment", title: "Empresa enriquecida", message: 'A empresa "FinEdge Pagamentos" foi enriquecida com sucesso.', read: false, created_at: minutesAgo(15), user_id: "demo", metadata: {} },
  { id: "notif2", type: "system", title: "Workflow concluído", message: 'O workflow "E-commerce Premium" foi concluído com sucesso. 156 leads qualificados.', read: false, created_at: minutesAgo(60), user_id: "demo", metadata: {} },
  { id: "notif3", type: "signal", title: "Sinal de intenção forte", message: "CloudBridge Infra visitou sua página de preços 3x hoje.", read: false, created_at: minutesAgo(120), user_id: "demo", metadata: {} },
  { id: "notif4", type: "enrichment", title: "Lote enriquecido", message: '12 empresas foram enriquecidas no workflow "SaaS B2B Nacional".', read: true, created_at: minutesAgo(240), user_id: "demo", metadata: {} },
  { id: "notif5", type: "system", title: "Raspagem concluída", message: 'Raspagem "Restaurantes Pinheiros" encontrou 87 resultados.', read: true, created_at: minutesAgo(360), user_id: "demo", metadata: {} },
  { id: "notif6", type: "signal", title: "Novo stakeholder", message: 'Stakeholder "Carlos Mendes" (CTO) encontrado na empresa TechNova.', read: true, created_at: minutesAgo(1440), user_id: "demo", metadata: {} },
  { id: "notif7", type: "scrape", title: "Nova empresa raspada", message: '"PayFlow Digital" — Fintech, São Paulo, SP', read: true, created_at: minutesAgo(1800), user_id: "demo", metadata: {} },
  { id: "notif8", type: "enrichment", title: "Score IPC atualizado", message: "NeoBank Brasil subiu para score IPC 91 após enriquecimento.", read: true, created_at: minutesAgo(2160), user_id: "demo", metadata: {} },
];
